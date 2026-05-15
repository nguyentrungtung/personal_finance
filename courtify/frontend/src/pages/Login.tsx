import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, ApiError } from '../lib/auth';

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [totpToken, setTotpToken] = useState('');
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const LoginSchema = z.object({
    email: z.string().email(t('login.errors.invalidEmail')),
    password: z.string().min(1, t('login.errors.passwordRequired')),
  });

  const TotpSchema = z.object({
    code: z.string().length(6, t('login.errors.totpLength')).regex(/^\d+$/, t('login.errors.totpDigits')),
  });

  type LoginForm = z.infer<typeof LoginSchema>;
  type TotpForm = z.infer<typeof TotpSchema>;

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(LoginSchema) });
  const totpForm = useForm<TotpForm>({ resolver: zodResolver(TotpSchema) });

  const handleCredentials = async (data: LoginForm) => {
    setServerError('');
    setIsLoading(true);
    try {
      const result = await login(data.email, data.password);
      if (result.requireTotp) {
        setTotpToken(result.totpToken || '');
        setStep('totp');
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'ACCOUNT_LOCKED') {
          setServerError(t('login.errors.accountLocked'));
        } else {
          setServerError(t('login.errors.invalidCredentials'));
        }
      } else {
        setServerError(t('login.errors.unexpected'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotp = async (data: TotpForm) => {
    setServerError('');
    setIsLoading(true);
    try {
      const { api } = await import('../lib/api');
      await api.post('/api/v1/auth/totp/verify', { totp_token: totpToken, code: data.code });
      navigate(from, { replace: true });
    } catch {
      setServerError(t('login.errors.invalidTotp'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">COURTIFY</h1>
          <p className="text-sm text-text-muted mt-1">{t('login.subtitle')}</p>
        </div>

        <div className="card">
          {step === 'credentials' ? (
            <>
              <h2 className="text-lg font-semibold text-text-primary mb-6">{t('login.signInTitle')}</h2>

              {serverError && (
                <div role="alert" className="mb-4 p-3 rounded bg-brand-red/10 border border-brand-red/30 text-brand-red text-sm">
                  {serverError}
                </div>
              )}

              <form onSubmit={loginForm.handleSubmit(handleCredentials)} noValidate>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
                      {t('login.email')}
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className="input"
                      aria-describedby={loginForm.formState.errors.email ? 'email-error' : undefined}
                      {...loginForm.register('email')}
                    />
                    {loginForm.formState.errors.email && (
                      <p id="email-error" role="alert" className="mt-1 text-xs text-brand-red">
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">
                      {t('login.password')}
                    </label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      className="input"
                      aria-describedby={loginForm.formState.errors.password ? 'password-error' : undefined}
                      {...loginForm.register('password')}
                    />
                    {loginForm.formState.errors.password && (
                      <p id="password-error" role="alert" className="mt-1 text-xs text-brand-red">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full"
                    aria-busy={isLoading}
                  >
                    {isLoading ? t('login.signingIn') : t('login.signIn')}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="text-text-muted hover:text-text-primary text-sm mb-4 flex items-center gap-1"
                aria-label={t('login.back')}
              >
                ← {t('login.back')}
              </button>
              <h2 className="text-lg font-semibold text-text-primary mb-2">{t('login.twoFactorTitle')}</h2>
              <p className="text-sm text-text-secondary mb-6">
                {t('login.twoFactorDesc')}
              </p>

              {serverError && (
                <div role="alert" className="mb-4 p-3 rounded bg-brand-red/10 border border-brand-red/30 text-brand-red text-sm">
                  {serverError}
                </div>
              )}

              <form onSubmit={totpForm.handleSubmit(handleTotp)} noValidate>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="totp-code" className="block text-sm font-medium text-text-secondary mb-1">
                      {t('login.twoFactorCode')}
                    </label>
                    <input
                      id="totp-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      className="input text-center text-lg tracking-widest font-mono"
                      placeholder="000000"
                      aria-describedby={totpForm.formState.errors.code ? 'code-error' : undefined}
                      {...totpForm.register('code')}
                    />
                    {totpForm.formState.errors.code && (
                      <p id="code-error" role="alert" className="mt-1 text-xs text-brand-red">
                        {totpForm.formState.errors.code.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary w-full"
                    aria-busy={isLoading}
                  >
                    {isLoading ? t('login.verifying') : t('login.verify')}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

