import { useState, useEffect } from 'react';
import { MunicipalityInfo, fetchMunicipalityInfo } from '@/lib/external-api';

const FALLBACK: MunicipalityInfo = {
    name: 'Greater Tzaneen Municipality',
    address1: 'Agatha St, Tzaneen 567',
    address2: 'Tzaneen',
    address3: '',
    postalCode: '0850',
    tel: '',
    fax: '',
    vatNo: '4130193669',
    email: '',
    website: '',
    receiptFooter: '',
    receiptHeader: '',
};

export function useMunicipalityInfo() {
    const [info, setInfo] = useState<MunicipalityInfo>(FALLBACK);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetchMunicipalityInfo().then((data) => {
            if (!cancelled) {
                setInfo(data);
                setLoading(false);
            }
        }).catch(() => {
            if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    return { info, loading };
}
