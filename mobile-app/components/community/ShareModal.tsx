import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { CalText } from '../CalText';
import { HelixaText } from '../HelixaText';
import { useCreatePost } from '../../hooks/useCommunity';
import { useTheme } from '../../context/ThemeContext';

const MAX_LENGTH = 2000;
const PINK = '#C93A86';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Picked = { uri: string; name?: string | null; type?: string | null };

/**
 * "Share Something" card. The draft (text + chosen image) survives closing the modal, and is only cleared
 * once the post actually went through, so a failed upload never loses what someone wrote.
 */
export function ShareModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [image, setImage] = useState<Picked | null>(null);
  const create = useCreatePost();

  const canPost = (text.trim().length > 0 || !!image) && !create.isPending;

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        setImage({ uri: a.uri, name: a.fileName, type: a.mimeType });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not open your photos.' });
    }
  };

  const submit = () => {
    if (!canPost) return;
    create.mutate(
      { body: text.trim(), image },
      {
        onSuccess: () => {
          setText('');
          setImage(null);
          onClose();
          Toast.show({ type: 'success', text1: 'Shared!', text2: 'Your post is live in the community.' });
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable
          onPress={() => !create.isPending && onClose()}
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 22 }}>
          {/* Swallow touches so tapping inside the card doesn't dismiss it. */}
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.card, borderRadius: 22, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 22,
              shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <CalText style={{ fontSize: 22, color: colors.text }}>Share Something</CalText>
              <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close" disabled={create.isPending}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_LENGTH}
              editable={!create.isPending}
              textAlignVertical="top"
              accessibilityLabel="Write your post"
              style={{
                marginTop: 18, minHeight: 150, maxHeight: 230, borderWidth: 1, borderColor: colors.border, borderRadius: 16,
                padding: 16, fontSize: 16, lineHeight: 23, color: colors.text, fontFamily: 'Helixa-Regular', backgroundColor: colors.bgSoft,
              }}
            />
            {text.length > MAX_LENGTH - 200 && (
              <HelixaText style={{ alignSelf: 'flex-end', marginTop: 6, fontSize: 12, color: text.length >= MAX_LENGTH ? '#D62D88' : colors.textMuted }}>
                {text.length}/{MAX_LENGTH}
              </HelixaText>
            )}

            {image && (
              <View style={{ marginTop: 14, alignSelf: 'flex-start' }}>
                <Image source={{ uri: image.uri }} style={{ width: 96, height: 96, borderRadius: 14 }} contentFit="cover" />
                <TouchableOpacity
                  onPress={() => setImage(null)}
                  disabled={create.isPending}
                  accessibilityLabel="Remove image"
                  hitSlop={8}
                  style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, borderRadius: 13, backgroundColor: '#1B2230', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="x" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
              <TouchableOpacity
                onPress={pickImage}
                disabled={create.isPending}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingHorizontal: 20, borderRadius: 25, borderWidth: 1, borderColor: colors.border }}>
                <Feather name="image" size={20} color={colors.textSecondary} />
                <HelixaText style={{ fontSize: 16, color: colors.textSecondary }}>{image ? 'Change image' : 'Add an image'}</HelixaText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={submit}
                disabled={!canPost}
                activeOpacity={0.8}
                accessibilityState={{ disabled: !canPost }}
                style={{ height: 50, minWidth: 120, paddingHorizontal: 28, borderRadius: 25, backgroundColor: PINK, opacity: canPost ? 1 : 0.45, alignItems: 'center', justifyContent: 'center' }}>
                {create.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <HelixaText weight="bold" style={{ fontSize: 17, color: '#FFF' }}>Post</HelixaText>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
