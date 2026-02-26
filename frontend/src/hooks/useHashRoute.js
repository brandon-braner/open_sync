import { useState, useEffect } from 'react';

export function useHashRoute() {
    const [hash, setHash] = useState(window.location.hash || '#/');
    useEffect(() => {
        const onHashChange = () => setHash(window.location.hash || '#/');
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);
    return hash;
}
