import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { UserProfile } from '../../types/lablink';
import { api, setAuthToken } from '../../lib/api';
import { isSupabaseClientConfigured, supabase } from '../../lib/supabase';
import { SPRING_TACTILE, TactileButton } from '../motion/MotionPrimitives';
import { LabBotMascot } from '../motion/LabBotMascot';

interface AdminLoginViewProps {
  onBackToSite: () => void;
  onAuthenticatedAdmin: (user: UserProfile) => void;
  deniedNotice?: string | null;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onBackToSite,
  onAuthenticatedAdmin,
  deniedNotice,
}) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('Marcus Chen');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [claimRequired, setClaimRequired] = useState(false);
  const [error, setError] = useState<string | null>(deniedNotice || null);

  useEffect(() => {
    api
      .adminStatus()
      .then((res) => {
        setSupabaseConnected(res.supabaseConfigured);
        setSchemaReady(res.schemaReady);
        setClaimRequired(res.claimRequired);
        if (res.configuredAdminEmailHint && !email) {
          setEmail(res.configuredAdminEmailHint);
        }
      })
      .catch(() => {
        setSupabaseConnected(false);
        setSchemaReady(false);
        setClaimRequired(false);
      })
      .finally(() => setStatusLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (claimRequired && !supabaseConnected) {
        const res = await api.adminClaim(email, name, password);
        setAuthToken(res.token);
        onAuthenticatedAdmin(res.user);
        return;
      }

      const res = await api.adminLogin(email.trim(), password);
      setAuthToken(res.token);

      if (supabaseConnected && isSupabaseClientConfigured && supabase && res.refreshToken) {
        await supabase.auth
          .setSession({
            access_token: res.token,
            refresh_token: res.refreshToken,
          })
          .catch(() => undefined);
      }

      onAuthenticatedAdmin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#fef9ee] text-[#1d1c15] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToSite}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ffffff] text-xs font-semibold text-[#1d1c15] clay-button-soft hover:-translate-y-0.5 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">arrow_back</span>
            <span>Back to LabLink</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#a8e8d5] flex items-center justify-center text-[#29695a]">
              <span className="material-symbols-outlined text-[18px]">science</span>
            </div>
            <span className="font-bold text-base text-[#1d1c15]">LabLink</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING_TACTILE}
          className="bg-[#ffffff] rounded-[2.25rem] p-7 sm:p-8 clay-card flex flex-col gap-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f8f3e8] text-[#29695a] text-[11px] font-semibold">
                <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
                <span>Authorized Staff Only</span>
              </span>
              <h1 className="text-2xl font-bold text-[#1d1c15] mt-2">
                {claimRequired ? 'Set Up Admin Account' : 'Admin Login'}
              </h1>
              <p className="text-xs text-[#3f4945] mt-1">
                {claimRequired
                  ? 'Set the first administrator password to lock initial platform setup.'
                  : 'Sign in with an authorized administrator email and password.'}
              </p>
            </div>
            <div className="shrink-0 hidden sm:block">
              <LabBotMascot size="sm" showSpeechBubble={false} />
            </div>
          </div>

          {!statusLoading && (
            <div
              className={`rounded-2xl p-3.5 text-xs flex items-start gap-2.5 ${
                supabaseConnected && schemaReady
                  ? 'bg-[#a8e8d5]/45 text-[#2b6a5b]'
                  : 'bg-[#f8de91]/55 text-[#4a3800]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                {supabaseConnected && schemaReady ? 'verified_user' : 'pending_actions'}
              </span>
              <div className="leading-relaxed">
                {supabaseConnected && schemaReady ? (
                  <>
                    <span className="font-bold block">Supabase Auth & RLS Active</span>
                    <span>
                      Admin access is verified against the database authorized_admins table.
                    </span>
                  </>
                ) : supabaseConnected && !schemaReady ? (
                  <>
                    <span className="font-bold block">Supabase Schema Setup Required</span>
                    <span>
                      Supabase credentials are configured, but required database tables have not
                      been created yet. Run supabase/schema.sql in your Supabase SQL Editor.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-bold block">Local Server Auth Mode</span>
                    <span>
                      Supabase environment variables are not connected in this environment. Running
                      with local signed-token admin checks.
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {claimRequired && !supabaseConnected && (
              <div>
                <label className="block text-xs font-semibold text-[#3f4945] mb-1">
                  Administrator Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Marcus Chen"
                  className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm text-[#1d1c15] clay-well focus:outline-none focus:ring-2 focus:ring-[#29695a]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#3f4945] mb-1">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@lablink.edu"
                className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm text-[#1d1c15] clay-well focus:outline-none focus:ring-2 focus:ring-[#29695a]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3f4945] mb-1">Password</label>
              <input
                type="password"
                required
                minLength={claimRequired ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={claimRequired ? 'Choose a password (min 8 chars)' : 'Enter password'}
                className="w-full rounded-full bg-[#f8f3e8] px-4 py-2.5 text-sm text-[#1d1c15] clay-well focus:outline-none focus:ring-2 focus:ring-[#29695a]"
              />
            </div>

            {error && (
              <div className="rounded-2xl bg-[#ffdad6] text-[#93000a] px-4 py-2.5 text-xs font-semibold">
                {error}
              </div>
            )}

            <TactileButton
              type="submit"
              variant="primary"
              loading={loading || statusLoading}
              className="w-full py-3 text-sm mt-1"
            >
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              <span>{claimRequired ? 'Save Password & Sign In' : 'Sign In as Admin'}</span>
            </TactileButton>
          </form>

          <p className="text-[11px] text-center text-[#3f4945] leading-relaxed">
            Admin accounts cannot be created through public sign-up. Only an existing administrator
            can grant admin access.
          </p>
        </motion.div>
      </div>
    </div>
  );
};
