import { useState, useEffect } from 'react';
import { MunicipalityInfo, fetchMunicipalityInfo } from '@/lib/external-api';

export function useMunicipalityInfo() {
    const [info, setInfo] = useState<MunicipalityInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchMunicipalityInfo().then((data) => {
            if (!cancelled) {
                setInfo(data);
                setLoading(false);
            }
        }).catch((e) => {
            if (!cancelled) {
                console.error('Failed to fetch municipality info from API:', e);
                setError('Could not load municipality information from the API.');
                setLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, []);

    return { info, loading, error };
}
