// src/components/admin/ProfileTab.tsx

import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';

const ProfileTab: React.FC = () => {
    const { companyInfo, updateCompanySettings } = usePos();
    const [formData, setFormData] = useState({ ...companyInfo });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setFormData({ ...companyInfo });
    }, [companyInfo]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateCompanySettings(formData);
            alert('Të dhënat e biznesit u ruajtën me sukses!');
        } catch (error) {
            alert('Ruajtja dështoi.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        // Added shadow and border to match other Admin tabs
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto shadow-lg border border-border">
            <h3 className="text-xl font-semibold mb-6 text-tsecondary">Të Dhënat e Biznesit</h3>
            {/* Added border to inner container */}
            <div className="space-y-4 bg-primary p-6 rounded-lg border border-border">
                <div>
                    <label className="block text-sm font-medium text-tsecondary">Emri i Biznesit</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full bg-secondary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight placeholder-tsubtle" placeholder="Emri i Restorantit" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-tsecondary">NUI (Numri Unik Identifikues)</label>
                    <input type="text" name="nui" value={formData.nui} onChange={handleChange} className="mt-1 block w-full bg-secondary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight placeholder-tsubtle" placeholder="psh. 812345678" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-tsecondary">Adresa</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className="mt-1 block w-full bg-secondary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight placeholder-tsubtle" placeholder="Rruga, Qyteti" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-tsecondary">Numri i Telefonit</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full bg-secondary border-border rounded-md p-2 text-tmain focus:ring-highlight focus:border-highlight placeholder-tsubtle" placeholder="+383 4X XXX XXX" />
                </div>
                <div className="flex justify-end pt-4">
                    {/* Changed to bg-success for semantic correctness (Save action) */}
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 rounded-lg bg-success text-white font-bold hover:bg-success-hover transition-colors disabled:bg-muted">
                        {isSaving ? 'Duke ruajtur...' : 'Ruaj Të Dhënat'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileTab;