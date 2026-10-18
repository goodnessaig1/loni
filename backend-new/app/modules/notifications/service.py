import asyncio
import json
import firebase_admin
from firebase_admin import messaging
from typing import Dict, Any, Union, List, Optional
from app.core import mongo_db
from datetime import datetime
from app.modules.notifications.voip_service import VoIPPushService, is_configured as voip_is_configured

class NotificationService:
    @staticmethod
    async def send_push_notification(tokens: Union[str, List[str]], title: str, body: str, data: Optional[Dict[str, Any]] = None):
        """
        Send a generic push notification via Firebase Admin SDK.

        Prunes permanently-dead tokens from Mongo when FCM reports one as
        unregistered - production log evidence: "Failed to send to token
        ...: Requested entity was not found" repeating on every single call
        for the same stale token (app reinstalled/uninstalled, token
        rotated, etc.) forever, since nothing ever removed it from the
        `devices` collection. Left unpruned, every future call to that user
        pays for a doomed FCM request and the failure noise makes real
        problems harder to spot in the logs.
        """
        if not tokens:
            return

        if isinstance(tokens, str):
            tokens = [tokens]

        # FCM data payload values must all be strings. The old code did
        # `str(v)` unconditionally, which for a nested dict (e.g. the
        # `caller`/`receiver` ParticipantInfo objects added for Issue 6/7)
        # produces Python's repr - single-quoted, not valid JSON - e.g.
        # "{'id': '123', 'name': \"O'Brien\"}". `JSON.parse()` on the client
        # would throw on that. Dicts/lists are now JSON-encoded properly so
        # the client can safely JSON.parse() them back out (see
        # lib/callEvents.ts on both mobile apps).
        def _stringify(v: Any) -> str:
            if isinstance(v, (dict, list)):
                return json.dumps(v)
            return str(v)

        firebase_data = {str(k): _stringify(v) for k, v in data.items()} if data else {}

        # Every call-related event (incoming_call, call_accepted,
        # call_rejected, call_ended, call_timeout, ...) is latency-sensitive
        # signaling, not a "check this out later" notification. Previously
        # only "incoming_call" was sent data-only + high priority; every
        # other call event (including call_accepted, the one Issue 1 is
        # about) fell into the `else` branch below and was sent as a mixed
        # notification+data message with DEFAULT priority. On Android that
        # lets the OS defer/batch delivery; on iOS default APNs priority (5)
        # allows the push to be delayed arbitrarily for power saving. That
        # is the direct cause of the multi-second-to-minutes "Accept" delay
        # in Issue 1.
        #
        # Fix: ALL call.* event types are sent as data-only, high-priority,
        # immediate-delivery pushes. The client is responsible for building
        # its own local notification/UI from the data payload (already true
        # for incoming_call via notifee; call_accepted etc. update the
        # WebSocket-driven call store directly and don't need a visible
        # system notification at all while the app is foregrounded).
        firebase_type = firebase_data.get("type", "")
        is_call_event = firebase_type.startswith("call") or firebase_type == "incoming_call"

        if is_call_event:
            message = messaging.MulticastMessage(
                data=firebase_data,
                tokens=tokens,
                android=messaging.AndroidConfig(
                    priority='high',
                    ttl=30,  # a stale "incoming call" push delivered late is worse than none
                ),
                apns=messaging.APNSConfig(
                    headers={
                        "apns-priority": "10",       # immediate delivery, required for time-sensitive pushes
                        "apns-push-type": "background" if firebase_type != "incoming_call" else "alert",
                        "apns-expiration": "30",
                    },
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            content_available=True,
                            sound="default" if firebase_type == "incoming_call" else None,
                        )
                    ),
                ),
            )
        else:
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=firebase_data,
                tokens=tokens,
            )

        try:
            # The Firebase SDK call is blocking HTTP; run it on a worker thread so one slow push
            # never stalls every other request, socket and timer on this process.
            response = await asyncio.to_thread(messaging.send_each_for_multicast, message)
            print(f"Push response: {response.success_count} messages were sent successfully")
            if response.failure_count > 0:
                responses = response.responses
                dead_tokens = []
                for idx, resp in enumerate(responses):
                    if not resp.success:
                        print(f"Failed to send to token {tokens[idx]}: {resp.exception}")
                        # Firebase's "unregistered" condition (app
                        # uninstalled, token rotated, etc.) surfaces either
                        # as a specific exception class or, depending on
                        # SDK version, just this exact message text - check
                        # both rather than depend on one exact class name
                        # we can't verify against the installed SDK version
                        # here.
                        is_unregistered = isinstance(
                            resp.exception, getattr(messaging, "UnregisteredError", ())
                        ) or "Requested entity was not found" in str(resp.exception)
                        if is_unregistered:
                            dead_tokens.append(tokens[idx])

                if dead_tokens:
                    result = await mongo_db.db["devices"].delete_many({"token": {"$in": dead_tokens}})
                    print(f"Pruned {result.deleted_count} dead device token(s) after FCM reported them unregistered")
        except Exception as e:
            print(f"Error sending push notification via Firebase: {e}")

    # Pushes that keep someone safe or let a call/ride work at all go out whatever the settings say.
    _ALWAYS = ("call_", "ride_", "account_", "incoming_call")

    @staticmethod
    async def _user_wants(user_id: str, event_type: Optional[str]) -> bool:
        """Honour the user's saved notification settings (account module) for optional pushes."""
        t = event_type or ""
        try:
            from app.core.database import AsyncSessionLocal
            from app.modules.account.models import UserSettings
            from app.modules.account.service import effective
            async with AsyncSessionLocal() as db:
                row = await db.get(UserSettings, user_id)
            prefs = effective(row.prefs if row else None)
        except Exception:
            return True  # settings unavailable: fail open, never drop a push by accident
        if t == "incoming_call":
            return prefs["incoming_calls"]
        if t == "ride_contact_alert" or any(t.startswith(p) for p in NotificationService._ALWAYS):
            return True
        return prefs["push"]

    @staticmethod
    async def notify_user(user_id: str, title: str, body: str, data: Optional[Dict[str, Any]] = None):
        """
        Retrieves all devices for a user and sends them a push notification.

        Issue 4 fix: iOS devices can register a second, VoIP-specific token
        (`device_type == "ios_voip"`, registered by
        loni-server-app/lib/voipPush.ts via PushKit) alongside their normal
        FCM/APNs token. For `incoming_call` specifically, a VoIP token - if
        present - is used INSTEAD of the regular token: VoIP pushes are the
        only Apple-guaranteed way to wake a force-quit app (see
        voip_service.py), and sending both would risk a double alert on a
        device that's merely backgrounded (not killed), where either path
        would have worked alone. Every other event type still goes through
        the regular FCM/APNs path only - PushKit VoIP pushes are reserved
        for actual incoming-call alerts per Apple's policy (misusing them
        for other notification types risks App Store rejection / API
        access revocation).
        """
        if not await NotificationService._user_wants(user_id, (data or {}).get("type")):
            return

        collection = mongo_db.db["devices"]
        cursor = collection.find({"user_id": user_id})
        devices = await cursor.to_list(length=100)

        is_incoming_call = (data or {}).get("type") == "incoming_call"
        voip_tokens = [d.get("token") for d in devices if d.get("device_type") == "ios_voip" and d.get("token")]

        if is_incoming_call and voip_tokens and voip_is_configured():
            await VoIPPushService.send_incoming_call(voip_tokens, data or {})
            fcm_tokens = [
                d.get("token") for d in devices
                if d.get("token") and d.get("device_type") not in ("ios_voip", "ios")
            ]
        else:
            fcm_tokens = [
                d.get("token") for d in devices
                if d.get("token") and d.get("device_type") != "ios_voip"
            ]

        if fcm_tokens:
            await NotificationService.send_push_notification(fcm_tokens, title, body, data)

    @staticmethod
    async def register_device(user_id: str, device_id: str, device_type: str, token: str):
        """
        Register a push token for a user. A token identifies one app install, so it belongs to exactly
        one account: registering it moves it to this user (whoever signed in last on the phone gets the
        pushes). Keyed by token, not device_id - Android's build id is shared by every phone on the
        same OS build, so it can't tell two phones apart.
        """
        collection = mongo_db.db["devices"]
        now = datetime.utcnow()
        # Registrations from before tokens were unique may list this token under other accounts too.
        await collection.delete_many({"token": token, "user_id": {"$ne": user_id}})
        await collection.update_one(
            {"token": token},
            {"$set": {"user_id": user_id, "device_id": device_id, "device_type": device_type, "updated_at": now},
             "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    @staticmethod
    async def unregister_device(user_id: str, token: str) -> int:
        """Signing out: this phone must stop receiving this account's pushes (calls, alerts)."""
        result = await mongo_db.db["devices"].delete_many({"token": token, "user_id": user_id})
        return result.deleted_count

    @staticmethod
    async def get_user_devices(user_id: str):
        """
        Get all registered devices for a user.
        """
        collection = mongo_db.db["devices"]
        cursor = collection.find({"user_id": user_id})
        devices = await cursor.to_list(length=100)
        return devices
