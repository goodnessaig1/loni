import { useEffect, useState, useCallback } from 'react';
import { useRoom, useParticipant, useTracks } from '@livekit/react-native';
import { Room, RoomEvent, Track, TrackEvent } from 'livekit-client';

const LIVEKIT_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL || 'ws://192.168.100.136:7880';

export const useLiveKit = (token: string | null) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    const connectToRoom = async () => {
      try {
        await newRoom.connect(LIVEKIT_URL, token);
        if (!mounted) {
          newRoom.disconnect();
          return;
        }
        setRoom(newRoom);
        setIsConnected(true);
        
        // Publish microphone by default
        await newRoom.localParticipant.setMicrophoneEnabled(true);
        setIsMicrophoneEnabled(true);
      } catch (error) {
        console.error("Error connecting to LiveKit room", error);
      }
    };

    connectToRoom();

    newRoom.on(RoomEvent.Disconnected, () => {
      if (mounted) setIsConnected(false);
    });

    return () => {
      mounted = false;
      newRoom.disconnect();
    };
  }, [token]);

  const toggleMicrophone = useCallback(async () => {
    if (room && room.localParticipant) {
      const newState = !isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(newState);
      setIsMicrophoneEnabled(newState);
    }
  }, [room, isMicrophoneEnabled]);

  return {
    room,
    isConnected,
    isMicrophoneEnabled,
    toggleMicrophone
  };
};
