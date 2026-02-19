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
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" data-testid="login-page">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="border-b bg-white text-center">
                    <CardTitle className="text-xl text-slate-800 flex items-center justify-center gap-2">
                        <LogIn className="h-5 w-5" />
                        Municipal POS Login
                    </CardTitle>
                    <p className="text-sm text-slate-500 mt-1">Sign in with your Platinum username</p>
                </CardHeader>
                <CardContent className="p-6 bg-white">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="username" className="text-slate-600 text-sm">Platinum Username</Label>
                            <Input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. Francois, Admin"
                                className="bg-slate-50 border-slate-300"
                                autoFocus
                                disabled={loading}
                                data-testid="input-username"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-slate-600 text-sm">
                                Password <span className="text-xs text-slate-400">(optional — leave blank for SSO login)</span>
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Leave blank for SSO"
                                className="bg-slate-50 border-slate-300"
                                disabled={loading}
                                data-testid="input-password"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="dbName" className="text-slate-600 text-sm">Database</Label>
                            <Input
                                id="dbName"
                                type="text"
                                value={dbName}
                                onChange={(e) => setDbName(e.target.value)}
                                className="bg-slate-50 border-slate-300"
                                disabled={loading}
                                data-testid="input-dbname"
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm text-center bg-red-50 p-2.5 rounded border border-red-200" data-testid="text-login-error">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-slate-800 hover:bg-slate-900"
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
        </div>
    );
}
