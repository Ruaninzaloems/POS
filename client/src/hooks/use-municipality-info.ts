import { useState, useEffect } from 'react';
import { MunicipalityInfo, fetchMunicipalityInfo } from '@/lib/external-api';

const FALLBACK: MunicipalityInfo = {
    name: 'George Municipality',
    address1: '71 York Street',
    address2: 'George',
    address3: '',
    postalCode: '6530',
    tel: '044 801 9111',
    fax: '',
    vatNo: '',
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
