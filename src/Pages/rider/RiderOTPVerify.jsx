import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRide } from '../../context/RideContext';
import { useOTPVerification } from '../../hooks/useOTPVerification';
import OTPInput from '../../Components/ui/OTPInput';

const RiderOTPVerify = () => {
  const navigate = useNavigate();
  const { ride } = useRide();
  const [otpValue, setOtpValue] = useState('');
  const [shake, setShake] = useState(false);

  const { verify, verifying, error, verified } = useOTPVerification(ride.rideId);

  useEffect(() => {
    if (!ride.rideId) navigate('/rider', { replace: true });
  }, [ride.rideId, navigate]);

  useEffect(() => {
    if (verified) {
      setTimeout(() => navigate('/rider/active'), 400);
    }
  }, [verified, navigate]);

  useEffect(() => {
    if (error) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 600);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleVerify = useCallback(async () => {
    if (otpValue.length !== 4) return;
    await verify(otpValue);
  }, [otpValue, verify]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)',
      }}
    >
      {/* Top Decoration */}
      <div className="flex-shrink-0 flex flex-col items-center pt-14 pb-8 px-6">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
          style={{
            background: 'linear-gradient(135deg, #2563EB22, #2563EB44)',
            border: '1.5px solid #2563EB55',
            boxShadow: '0 8px 32px #2563EB22',
          }}
        >
          <span className="text-4xl">🔐</span>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Passenger OTP
        </h1>
        <p className="text-sm text-slate-400 text-center leading-relaxed max-w-xs">
          Ask <span className="text-white font-semibold">{ride.passengerName ?? 'your passenger'}</span> to
          show their 4-digit OTP. Enter it below to confirm boarding.
        </p>
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-t-3xl px-6 pt-8 pb-10 flex flex-col"
        style={{ background: 'white' }}
      >
        {/* Passenger info strip */}
        <div
          className="rounded-2xl p-4 mb-8 flex items-center gap-4"
          style={{ background: '#F0F9FF', border: '1.5px solid #BFDBFE' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
          >
            {ride.passengerName?.charAt(0) ?? 'P'}
          </div>
          <div>
            <p className="font-bold text-slate-900">{ride.passengerName ?? '—'}</p>
            <p className="text-sm text-slate-500">📍 {ride.passengerPickup?.label ?? '—'}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-slate-400">Pickup</p>
            <p className="text-sm font-semibold text-blue-600">Now</p>
          </div>
        </div>

        {/* OTP Input */}
        <div
          className={`mb-3 transition-transform ${shake ? 'animate-shake' : ''}`}
          style={shake ? { animation: 'shake 0.5s ease' } : {}}
        >
          <p className="text-center text-sm text-slate-500 mb-4">Enter 4-digit OTP</p>
          <OTPInput
            length={4}
            onChange={setOtpValue}
            disabled={verifying || verified}
            error={!!error}
          />
        </div>

        {/* Error */}
        <div className="h-6 mb-6 flex items-center justify-center">
          {error && (
            <p className="text-sm text-red-500 font-medium text-center animate-fade-in">
              {error}
            </p>
          )}
          {verified && (
            <p className="text-sm text-green-600 font-semibold text-center">
              ✓ OTP Verified! Starting ride...
            </p>
          )}
        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          disabled={otpValue.length !== 4 || verifying || verified}
          className="w-full py-4 rounded-2xl text-base font-bold text-white transition-all duration-200 active:scale-95"
          style={{
            background:
              otpValue.length === 4 && !verifying && !verified
                ? 'linear-gradient(135deg, #16a34a, #15803d)'
                : '#CBD5E1',
            boxShadow:
              otpValue.length === 4
                ? '0 4px 16px rgba(22,163,74,0.35)'
                : 'none',
          }}
        >
          {verifying ? 'Verifying...' : verified ? '✓ Verified!' : 'Confirm OTP & Start Ride'}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4 leading-relaxed">
          Ask your passenger to open RideMate and share their OTP screen
        </p>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-8px)}
          30%{transform:translateX(8px)}
          45%{transform:translateX(-6px)}
          60%{transform:translateX(6px)}
          75%{transform:translateX(-4px)}
          90%{transform:translateX(4px)}
        }
        .animate-fade-in{animation:fadeIn 0.2s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
};

export default RiderOTPVerify;