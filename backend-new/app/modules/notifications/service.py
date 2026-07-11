import firebase_admin
from firebase_admin import messaging
from typing import Dict, Any, Union, List, Optional
from app.core import mongo_db
from datetime import datetime

class NotificationService:
    @staticmethod
    def send_push_notification(tokens: Union[str, List[str]], title: str, body: str, data: Optional[Dict[str, Any]] = None):
        """
        Send a generic push notification via Firebase Admin SDK.
        """
        if not tokens:
            return
            
        if isinstance(tokens, str):
            tokens = [tokens]
        
        # Ensure data values are strings as required by Firebase
        firebase_data = {str(k): str(v) for k, v in data.items()} if data else {}
        
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=firebase_data,
            tokens=tokens,
        )
        
        try:
            response = messaging.send_each_for_multicast(message)
            print(f"Push response: {response.success_count} messages were sent successfully")
            if response.failure_count > 0:
                responses = response.responses
                for idx, resp in enumerate(responses):
                    if not resp.success:
                        print(f"Failed to send to token {tokens[idx]}: {resp.exception}")
        except Exception as e:
            print(f"Error sending push notification via Firebase: {e}")

    @staticmethod
    async def notify_user(user_id: str, title: str, body: str, data: Optional[Dict[str, Any]] = None):
        """
        Retrieves all devices for a user and sends them a push notification.
        """
        collection = mongo_db.db["devices"]
        cursor = collection.find({"user_id": user_id})
        devices = await cursor.to_list(length=100)
        tokens = [device.get("token") for device in devices if device.get("token")]
        
        if tokens:
            NotificationService.send_push_notification(tokens, title, body, data)

    @staticmethod
    async def register_device(user_id: str, device_id: str, device_type: str, token: str):
        """
        Register a device token for a user.
        """
        collection = mongo_db.db["devices"]
        
        existing = await collection.find_one({"device_id": device_id, "user_id": user_id})
        if existing:
            # Update token if it changed
            if existing.get("token") != token:
                await collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"token": token, "updated_at": datetime.utcnow()}}
                )
        else:
            new_device = {
                "user_id": user_id,
                "device_id": device_id,
                "device_type": device_type,
                "token": token,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await collection.insert_one(new_device)

    @staticmethod
    async def get_user_devices(user_id: str):
        """
        Get all registered devices for a user.
        """
        collection = mongo_db.db["devices"]
        cursor = collection.find({"user_id": user_id})
        devices = await cursor.to_list(length=100)
        return devices
