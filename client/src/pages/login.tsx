import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';
import { loginUser } from '@/lib/external-api';

interface LoginProps {
    onLoginSuccess: (user: any) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [dbName, setDbName] = useState('George');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim()) {
            setError('Please enter your Platinum username.');
            return;
        }

        setLoading(true);
        try {
            const data = await loginUser(username.trim(), password || '', dbName.trim());

            if (data.success && data.user) {
                onLoginSuccess(data.user);
            } else {
                setError(data.error || 'Login failed. Please check your credentials.');
            }
        } catch (err: any) {
            setError('Could not connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden" data-testid="login-page">
            <div className="absolute inset-0 opacity-30">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-400/20 via-transparent to-transparent" />
            </div>

            <Card className="w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl border-0 rounded-xl overflow-hidden relative z-10">
                <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t" />
                <CardHeader className="text-center pt-8 pb-4">
                    <div className="flex justify-center mb-3">
                        <img src="/images/platinum-logo.png" alt="Platinum" className="w-14 h-14 object-contain" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">
                        Platinum POS
                    </CardTitle>
                    <p className="text-sm text-slate-500 mt-1">Municipal Receipting System</p>
                </CardHeader>
                <CardContent className="px-6 pb-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="username" className="text-slate-600 text-sm font-medium">Platinum Username</Label>
                            <Input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. Francois, Admin"
                                className="h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                autoFocus
                                disabled={loading}
                                data-testid="input-username"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-slate-600 text-sm font-medium">
                                Password <span className="text-xs text-slate-400">(optional — leave blank for SSO login)</span>
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Leave blank for SSO"
                                className="h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                disabled={loading}
                                data-testid="input-password"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="dbName" className="text-slate-600 text-sm font-medium">Database</Label>
                            <Input
                                id="dbName"
                                type="text"
                                value={dbName}
                                onChange={(e) => setDbName(e.target.value)}
                                className="h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                disabled={loading}
                                data-testid="input-dbname"
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm text-center bg-red-50 p-2.5 rounded-lg border border-red-200" data-testid="text-login-error">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 h-12 text-base font-semibold rounded-xl transition-all"
                            disabled={loading}
                            data-testid="button-login"
                        >
                            {loading ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in...</>
                            ) : (
                                'Sign In'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div className="fixed bottom-4 right-4 z-20">
                <span className="text-[10px] font-medium bg-white/10 text-white/60 backdrop-blur-sm px-2 py-1 rounded-full">v2.0</span>
            </div>
        </div>
    );
}
