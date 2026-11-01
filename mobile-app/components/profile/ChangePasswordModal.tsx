import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { HelixaText } from '../HelixaText';
import { ModalKeyboardAvoid } from '../KeyboardAvoid';
import { useTheme } from '../../context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useChangePassword } from '../../hooks/useAuth';
import Toast from 'react-native-toast-message';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

const ChangePasswordSchema = Yup.object().shape({
  oldPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords do not match')
    .required('Please confirm your new password'),
});

export const ChangePasswordModal = ({ visible, onClose }: ChangePasswordModalProps) => {
  const { colors, isDark } = useTheme();
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { mutateAsync: changePassword, isPending } = useChangePassword();

  const formik = useFormik({
    initialValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: ChangePasswordSchema,
    onSubmit: async (values, { resetForm, setFieldError }) => {
      try {
        await changePassword({ old_password: values.oldPassword, new_password: values.newPassword });
        Toast.show({ type: 'success', text1: 'Password changed successfully.' });
        resetForm();
        onClose();
      } catch (error: any) {
        console.log(error);
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Failed to change password.';
        
        if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('incorrect') || errorMessage.toLowerCase().includes('400')) {
          setFieldError('oldPassword', errorMessage);
        } else {
          Toast.show({ type: 'error', text1: 'Error', text2: errorMessage });
        }
      }
    },
  });

  const handleClose = () => {
    formik.resetForm();
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const isButtonDisabled = !formik.isValid || !formik.dirty || isPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <ModalKeyboardAvoid style={{ flex: 1, backgroundColor: colors.overlay }}>
        <View className="flex-1 justify-end">
          <TouchableOpacity 
            className="absolute top-0 bottom-0 left-0 right-0" 
            onPress={handleClose} 
            activeOpacity={1} 
          />
          
          <View className="rounded-t-[32px] p-6 w-full max-h-[90%] pt-4 pb-12" style={{ backgroundColor: colors.bg }}>
            <View className="items-center mb-6">
              <View className="w-12 h-1.5 rounded-full mb-6" style={{ backgroundColor: isDark ? '#3A3D44' : '#D1D5DB' }} />
              <HelixaText className="text-[20px] text-center" weight="bold">Change Password</HelixaText>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <View className="mb-4">
              <HelixaText className="text-[14px] mb-2" weight="bold">Current Password</HelixaText>
              <View className="relative justify-center">
                <TextInput
                  className="border rounded-[16px] px-4 py-4 pr-12 text-[15px]"
                  style={{ backgroundColor: colors.bgSoft, color: colors.text, borderColor: formik.touched.oldPassword && formik.errors.oldPassword ? '#EF4444' : colors.border }}
                  placeholderTextColor={colors.textMuted}
                  placeholder="Enter current password"
                  secureTextEntry={!showOldPassword}
                  value={formik.values.oldPassword}
                  onChangeText={formik.handleChange('oldPassword')}
                  onBlur={formik.handleBlur('oldPassword')}
                />
                <TouchableOpacity 
                  className="absolute right-4" 
                  onPress={() => setShowOldPassword(!showOldPassword)}
                >
                  <Feather name={showOldPassword ? "eye" : "eye-off"} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {formik.touched.oldPassword && formik.errors.oldPassword && (
                <HelixaText className="text-red-500 text-[12px] mt-1 ml-1">{formik.errors.oldPassword}</HelixaText>
              )}
            </View>

            <View className="mb-4">
              <HelixaText className="text-[14px] mb-2" weight="bold">New Password</HelixaText>
              <View className="relative justify-center">
                <TextInput
                  className="border rounded-[16px] px-4 py-4 pr-12 text-[15px]"
                  style={{ backgroundColor: colors.bgSoft, color: colors.text, borderColor: formik.touched.newPassword && formik.errors.newPassword ? '#EF4444' : colors.border }}
                  placeholderTextColor={colors.textMuted}
                  placeholder="Enter new password"
                  secureTextEntry={!showNewPassword}
                  value={formik.values.newPassword}
                  onChangeText={formik.handleChange('newPassword')}
                  onBlur={formik.handleBlur('newPassword')}
                />
                <TouchableOpacity 
                  className="absolute right-4" 
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Feather name={showNewPassword ? "eye" : "eye-off"} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {formik.touched.newPassword && formik.errors.newPassword && (
                <HelixaText className="text-red-500 text-[12px] mt-1 ml-1">{formik.errors.newPassword}</HelixaText>
              )}
            </View>

            <View className="mb-8">
              <HelixaText className="text-[14px] mb-2" weight="bold">Confirm New Password</HelixaText>
              <View className="relative justify-center">
                <TextInput
                  className="border rounded-[16px] px-4 py-4 pr-12 text-[15px]"
                  style={{ backgroundColor: colors.bgSoft, color: colors.text, borderColor: formik.touched.confirmPassword && formik.errors.confirmPassword ? '#EF4444' : colors.border }}
                  placeholderTextColor={colors.textMuted}
                  placeholder="Confirm new password"
                  secureTextEntry={!showConfirmPassword}
                  value={formik.values.confirmPassword}
                  onChangeText={formik.handleChange('confirmPassword')}
                  onBlur={formik.handleBlur('confirmPassword')}
                />
                <TouchableOpacity 
                  className="absolute right-4" 
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                <HelixaText className="text-red-500 text-[12px] mt-1 ml-1">{formik.errors.confirmPassword}</HelixaText>
              )}
            </View>

            <TouchableOpacity 
              className={`w-full py-4 rounded-full items-center mb-6 flex-row justify-center ${isButtonDisabled ? 'bg-[#D62D88]/50' : 'bg-[#D62D88]'}`}
              onPress={() => formik.handleSubmit()}
              disabled={isButtonDisabled}
            >
              {isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <HelixaText className="text-white text-[16px]" weight="bold">Update Password</HelixaText>
              )}
            </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </ModalKeyboardAvoid>
    </Modal>
  );
};
