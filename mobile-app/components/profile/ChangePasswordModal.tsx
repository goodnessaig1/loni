import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { HelixaText } from '../HelixaText';
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
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity 
            className="absolute top-0 bottom-0 left-0 right-0" 
            onPress={handleClose} 
            activeOpacity={1} 
          />
          
          <View className="bg-white rounded-t-[32px] p-6 w-full max-h-[90%] pt-4 pb-12">
            <View className="items-center mb-6">
              <View className="w-12 h-1.5 bg-gray-300 rounded-full mb-6" />
              <HelixaText className="text-[20px] text-center" weight="bold">Change Password</HelixaText>
            </View>

            <View className="mb-4">
              <HelixaText className="text-[14px] mb-2 text-gray-700" weight="bold">Current Password</HelixaText>
              <View className="relative justify-center">
                <TextInput
                  className={`bg-[#F9FAFB] border ${formik.touched.oldPassword && formik.errors.oldPassword ? 'border-red-500' : 'border-gray-200'} rounded-[16px] px-4 py-4 pr-12 text-[15px]`}
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
              <HelixaText className="text-[14px] mb-2 text-gray-700" weight="bold">New Password</HelixaText>
              <View className="relative justify-center">
                <TextInput
                  className={`bg-[#F9FAFB] border ${formik.touched.newPassword && formik.errors.newPassword ? 'border-red-500' : 'border-gray-200'} rounded-[16px] px-4 py-4 pr-12 text-[15px]`}
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
              <HelixaText className="text-[14px] mb-2 text-gray-700" weight="bold">Confirm New Password</HelixaText>
              <View className="relative justify-center">
                <TextInput
                  className={`bg-[#F9FAFB] border ${formik.touched.confirmPassword && formik.errors.confirmPassword ? 'border-red-500' : 'border-gray-200'} rounded-[16px] px-4 py-4 pr-12 text-[15px]`}
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
