import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Building2 } from 'lucide-react';
import { loginUser, fetchSites } from '@/lib/external-api';

interface SiteOption {
    id: string;
    name: string;
    logo: string;
    themeClass: string;
}

interface LoginProps {
    onLoginSuccess: (user: any, site?: any) => void;
}

const SITE_STYLES: Record<string, {
    gradient: string;
    overlayFrom: string;
    overlayTo: string;
    accentBar: string;
    buttonGradient: string;
    buttonHover: string;
    buttonShadow: string;
    inputFocus: string;
    title: string;
    subtitle: string;
}> = {
    george: {
        gradient: 'from-slate-900 via-blue-900 to-indigo-900',
        overlayFrom: 'from-blue-400/20',
        overlayTo: 'from-indigo-400/20',
        accentBar: 'from-blue-600 to-indigo-600',
        buttonGradient: 'from-blue-600 to-indigo-600',
        buttonHover: 'hover:from-blue-700 hover:to-indigo-700',
        buttonShadow: 'shadow-blue-500/25',
        inputFocus: 'focus:ring-blue-500/20 focus:border-blue-500',
        title: 'Platinum POS',
        subtitle: 'George Municipality',
    },
    site02: {
        gradient: 'from-[#1a2e42] via-[#243A53] to-[#1d3347]',
        overlayFrom: 'from-[#2BB3A6]/20',
        overlayTo: 'from-[#6EC6C0]/20',
        accentBar: 'from-[#2BB3A6] to-[#6EC6C0]',
        buttonGradient: 'from-[#2BB3A6] to-[#249E92]',
        buttonHover: 'hover:from-[#249E92] hover:to-[#1f8a80]',
        buttonShadow: 'shadow-[#2BB3A6]/25',
        inputFocus: 'focus:ring-[#2BB3A6]/20 focus:border-[#2BB3A6]',
        title: 'Inzalo EMS',
        subtitle: 'Municipal Receipting System',
    },
};

function getStyles(siteId: string) {
    return SITE_STYLES[siteId] || SITE_STYLES.george;
}

export default function LoginPage({ onLoginSuccess }: LoginProps) {
    const [sites, setSites] = useState<SiteOption[]>([]);
    const [selectedSite, setSelectedSite] = useState<SiteOption | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [dbName, setDbName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingSites, setLoadingSites] = useState(true);

    useEffect(() => {
        fetchSites()
            .then(data => {
                setSites(data);
                if (data.length === 1) {
                    setSelectedSite(data[0]);
                    setDbName(data[0].id === 'george' ? 'George' : 'Site02');
                }
            })
            .catch(() => {})
            .finally(() => setLoadingSites(false));
    }, []);

    const handleSelectSite = (site: SiteOption) => {
        setSelectedSite(site);
        setDbName(site.id === 'george' ? 'George' : 'Site02');
        setError('');
    };

    const handleBack = () => {
        setSelectedSite(null);
        setError('');
        setUsername('');
        setPassword('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim()) {
            setError('Please enter your username.');
            return;
        }

        setLoading(true);
        try {
            const data = await loginUser(username.trim(), password || '', dbName.trim(), selectedSite?.id);

            if (data.success && data.user) {
                onLoginSuccess(data.user, data.site);
            } else {
                setError(data.error || 'Login failed. Please check your credentials.');
            }
        } catch (err: any) {
            setError('Could not connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const styles = selectedSite ? getStyles(selectedSite.id) : SITE_STYLES.george;

    if (!selectedSite) {
        return (
            <div className={`min-h-screen bg-gradient-to-br ${styles.gradient} flex items-center justify-center p-4 relative overflow-hidden`} data-testid="login-page">
                <div className="absolute inset-0 opacity-30">
                    <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${styles.overlayFrom} via-transparent to-transparent`} />
                    <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] ${styles.overlayTo} via-transparent to-transparent`} />
                </div>

                <Card className="w-full max-w-lg bg-white/95 backdrop-blur-xl shadow-2xl border-0 rounded-xl overflow-hidden relative z-10">
                    <div className={`h-1.5 bg-gradient-to-r ${styles.accentBar} rounded-t`} />
                    <CardHeader className="text-center pt-8 pb-2">
                        <div className="flex justify-center mb-3">
                            <Building2 className="w-12 h-12 text-slate-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">
                            Select Your Site
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1">Choose the EMS environment to connect to</p>
                    </CardHeader>
                    <CardContent className="px-6 pb-8">
                        {loadingSites ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                            </div>
                        ) : (
                            <div className="space-y-3 mt-2">
                                {sites.map((site) => {
                                    const siteStyles = getStyles(site.id);
                                    return (
                                        <button
                                            key={site.id}
                                            onClick={() => handleSelectSite(site)}
                                            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all group cursor-pointer text-left"
                                            data-testid={`button-site-${site.id}`}
                                        >
                                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                                                <img
                                                    src={site.logo}
                                                    alt={site.name}
                                                    className="w-10 h-10 object-contain"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-slate-800 text-base">{siteStyles.title}</div>
                                                <div className="text-sm text-slate-500">{site.name}</div>
                                            </div>
                                            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${siteStyles.accentBar} opacity-60 group-hover:opacity-100 transition-opacity`} />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="fixed bottom-4 right-4 z-20">
                    <span className="text-[10px] font-medium bg-white/10 text-white/60 backdrop-blur-sm px-2 py-1 rounded-full">v2.0</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-gradient-to-br ${styles.gradient} flex items-center justify-center p-4 relative overflow-hidden`} data-testid="login-page">
            <div className="absolute inset-0 opacity-30">
                <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${styles.overlayFrom} via-transparent to-transparent`} />
                <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] ${styles.overlayTo} via-transparent to-transparent`} />
            </div>

            <Card className="w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl border-0 rounded-xl overflow-hidden relative z-10">
                <div className={`h-1.5 bg-gradient-to-r ${styles.accentBar} rounded-t`} />
                <CardHeader className="text-center pt-6 pb-4">
                    {sites.length > 1 && (
                        <button
                            onClick={handleBack}
                            className="absolute left-4 top-5 text-slate-400 hover:text-slate-600 transition-colors p-1"
                            data-testid="button-back-to-sites"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className="flex justify-center mb-3">
                        <img src={selectedSite.logo} alt={selectedSite.name} className="w-14 h-14 object-contain" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-800 tracking-tight">
                        {styles.title}
                    </CardTitle>
                    <p className="text-sm text-slate-500 mt-1">{styles.subtitle}</p>
                </CardHeader>
                <CardContent className="px-6 pb-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="username" className="text-slate-600 text-sm font-medium">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className={`h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:ring-2 ${styles.inputFocus} transition-all`}
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
                                className={`h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:ring-2 ${styles.inputFocus} transition-all`}
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
                                className={`h-11 rounded-xl bg-slate-50/80 border-slate-200 focus:ring-2 ${styles.inputFocus} transition-all`}
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
                            className={`w-full bg-gradient-to-r ${styles.buttonGradient} ${styles.buttonHover} shadow-lg ${styles.buttonShadow} h-12 text-base font-semibold rounded-xl transition-all`}
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
