import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Eye, EyeOff, CheckCircle2, ChevronLeft } from 'lucide-react';
import { apiRequest } from '../utils/api';

type Phase = 'setup' | 'verify' | 'success';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [phase, setPhase] = useState<Phase>('setup');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP State
  const [code, setCode] = useState(['', '', '', '']);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await apiRequest('/auth/setup-partner', {
        method: 'POST',
        body: { email, password, phone }
      });

      setPhase('verify');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const hasPlus = input.startsWith('+');
    let digits = input.replace(/\D/g, '');
    let newPhone = '';
    
    if (hasPlus) {
      newPhone = '+' + digits;
    } else {
      const match = digits.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
      if (!match) {
        newPhone = digits;
      } else {
        let formatted = match[1];
        if (match[2]) {
          formatted = `(${match[1]}) ${match[2]}`;
        }
        if (match[3]) {
          formatted += `-${match[3]}`;
        }
        newPhone = formatted;
      }
    }
    
    setPhone(newPhone);
    // Explicitly set the DOM value to prevent React state bailout 
    // where the DOM keeps invalid characters if the state didn't change
    e.target.value = newPhone;
  };

  const handleCodeChange = (text: string, index: number) => {
    const newText = text.replace(/[^0-9]/g, '');
    const newCode = [...code];
    newCode[index] = newText;
    setCode(newCode);

    if (newText && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const isComplete = code.every(digit => digit.length === 1);

  const handleVerifySubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      await apiRequest('/auth/verify-partner-setup', {
        method: 'POST',
        body: { email, otp: code.join('') }
      });

      setPhase('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');
    try {
      await apiRequest('/auth/resend-otp', {
        method: 'POST',
        body: { email, type: 'phone_verification' }
      });
      // Optionally show a success toast here
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (phase === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center space-y-6">
          <div className="flex justify-center mb-4">
            <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" className="h-10" />
          </div>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 mb-2">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Account Ready!</h2>
          <p className="text-gray-600">
            You are now successfully connected to your partner's support circle!
          </p>
          <div className="bg-pink-50 text-pink-700 p-4 rounded-xl text-sm border border-pink-100 mt-6">
            Please download the <strong>Loni App</strong> from the App Store or Google Play to receive updates and stay connected.
          </div>
          <button 
            className="w-full mt-6 bg-[#D62D88] hover:bg-[#B51E71] transition-colors text-white py-4 rounded-xl font-semibold shadow-sm shadow-pink-200"
            onClick={() => window.location.href = 'https://loni.app'}
          >
            Download the Loni App
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-gray-100">
          <div>
            <button onClick={() => setPhase('setup')} className="text-gray-800 mb-6 hover:text-gray-600 transition-colors">
              <ChevronLeft size={28} />
            </button>
            <h2 className="text-[28px] font-bold text-gray-900 tracking-tight leading-tight mb-2">
              Enter Verification Code
            </h2>
            <p className="text-[16px] text-[#6B7280] leading-relaxed">
              We sent a 4-digit code to {email}
            </p>
          </div>

          <div className="mt-8">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 text-center mb-6">
                {error}
              </div>
            )}

            <label className="block text-[15px] font-bold text-gray-900 mb-4">Enter Code</label>
            
            <div className="flex justify-center gap-4 mb-10">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleCodeChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className={`w-[65px] h-[65px] text-center text-2xl font-medium rounded-xl border focus:outline-none transition-colors ${
                    digit 
                      ? 'bg-white border-[#D62D88] text-gray-900' 
                      : 'bg-[#F9FAFB] border-gray-200 text-gray-900 focus:border-[#D62D88]'
                  }`}
                />
              ))}
            </div>

            <div className="mb-10">
              <button 
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-[#D62D88] text-[15px] font-bold hover:text-[#B51E71] disabled:opacity-50"
              >
                Resend Code
              </button>
            </div>

            <button
              onClick={handleVerifySubmit}
              disabled={isLoading || !isComplete}
              className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-sm shadow-pink-200 text-base font-semibold text-white bg-[#D62D88] hover:bg-[#B51E71] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D62D88] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Verify'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-gray-100">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="Loni Logo" className="h-10" />
          </div>
          <h2 className="text-[28px] font-bold text-gray-900 tracking-tight leading-tight">Complete Setup</h2>
          <p className="mt-3 text-[16px] text-[#6B7280]">
            You've been invited to Loni. Let's finish setting up your partner account.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSetupSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 text-center">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full px-4 py-3.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Create Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D62D88] focus:border-transparent outline-none transition-all pr-12"
                  placeholder="Enter a secure password"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
              <input
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={handlePhoneChange}
                className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#D62D88] focus:border-transparent outline-none transition-all"
                placeholder="(555) 000-0000 or +234..."
                maxLength={16}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-sm shadow-pink-200 text-base font-semibold text-white bg-[#D62D88] hover:bg-[#B51E71] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D62D88] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Next'}
          </button>
        </form>
      </div>
    </div>
  );
}
