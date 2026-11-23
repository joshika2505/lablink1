import React, { useState } from 'react';
import type { UserProfile } from '../../types/lablink';
import { api, setAuthToken } from '../../lib/api';
import { isSupabaseClientConfigured, supabase } from '../../lib/supabase';
import { ClayModal, TactileButton } from '../motion/MotionPrimitives';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Bioengineering');
  const [requestFaculty, setRequestFaculty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res =
        mode === 'signin'
          ? await api.login(email.trim(), password)
          : await api.register({
              email: email.trim(),
              name: name.trim(),
              password,
              department,
              requestFaculty,
            });

      if (!res.token) {
        setNotice(
          'Account created! Please check your email inbox to verify your address before signing in.',
        );
        setMode('signin');
        return;
      }

      setAuthToken(res.token);

      if (isSupabaseClientConfigured && supabase && res.refreshToken) {
        await supabase.auth
          .setSession({
            access_token: res.token,
            refresh_token: res.refreshToken,
          })
          .catch(() => undefined);
      }

      onAuthenticated(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClayModal open={open} onClose={onClose} maxWidthClass="max-w-md" ariaLabel="LabLink Sign In">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#29695a]">
              University Account
            </span>
            <h3 className="text-2xl font-bold text-[#1d1c15] mt-0.5">
              {mode === 'signin' ? 'Sign in to LabLink' : 'Create University Account'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="w-9 h-9 rounded-full bg-[#f8f3e8] text-[#3f4945] flex items-center justify-center hover:bg-[#ede8dd] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {notice && (
          <div className="rounded-2xl bg-[#a8e8d5]/55 text-[#2b6a5b] px-4 py-3 text-xs font-semibold">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#3f4945] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm text-[#1d1c15] clay-well focus:outline-none focus:ring-2 focus:ring-[#29695a]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3f4945] mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm text-[#1d1c15] clay-well focus:outline-none focus:ring-2 focus:ring-[#29695a]"
                >
                  <option value="Bioengineering">Bioengineering</option>
                  <option value="Robotics & ECE">Robotics & ECE</option>
                  <option value="Materials & Chem">Materials & Chem</option>
                  <option value="Rapid Prototyping">Rapid Prototyping</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Computer Science">Computer Science</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#3f4945] mb-1">
              University Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm text-[#1d1c15] clay-well focus:outline-none focus:ring-2 focus:ring-[#29695a]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3f4945] mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm text-[#1d1c15] clay-well focus:outline-none focus:ring-2 focus:ring-[#29695a]"
            />
          </div>

          {mode === 'register' && (
            <label className="flex items-start gap-2.5 rounded-2xl bg-[#f8f3e8] p-3.5 text-xs text-[#1d1c15] cursor-pointer clay-well">
              <input
                type="checkbox"
                checked={requestFaculty}
                onChange={(e) => setRequestFaculty(e.target.checked)}
                className="mt-0.5 rounded accent-[#29695a]"
              />
              <span>
                <strong className="block text-[#29695a]">
                  Request Faculty Account (Requires Admin Approval)
                </strong>
                <span className="text-[11px] text-[#3f4945]">
                  New accounts start with Student access until an administrator approves your
                  faculty status.
                </span>
              </span>
            </label>
          )}

          {error && (
            <div className="rounded-2xl bg-[#ffdad6] text-[#93000a] px-4 py-2.5 text-xs font-medium">
              {error}
            </div>
          )}

          <TactileButton
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full py-3 text-sm mt-1"
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </TactileButton>
        </form>

        <div className="text-center text-xs text-[#3f4945]">
          {mode === 'signin' ? (
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setNotice(null);
              }}
              className="font-semibold text-[#29695a] hover:underline cursor-pointer"
            >
              New to LabLink? Create an account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
                setNotice(null);
              }}
              className="font-semibold text-[#29695a] hover:underline cursor-pointer"
            >
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </ClayModal>
  );
};
