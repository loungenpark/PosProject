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
        <div className="bg-secondary p-6 rounded-lg max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-6 text-text-main">Të Dhënat e Biznesit</h3>
            <div className="space-y-4 bg-primary p-6 rounded-lg">
                <div>
                    <label className="block text-sm font-medium text-text-secondary">Emri i Biznesit</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" placeholder="Emri i Restorantit" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary">NUI (Numri Unik Identifikues)</label>
                    <input type="text" name="nui" value={formData.nui} onChange={handleChange} className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" placeholder="psh. 812345678" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary">Adresa</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" placeholder="Rruga, Qyteti" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary">Numri i Telefonit</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full bg-secondary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight" placeholder="+383 4X XXX XXX" />
                </div>
                <div className="flex justify-end pt-4">
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-3 rounded-lg bg-highlight text-white font-bold hover:bg-blue-600 transition-colors disabled:bg-gray-500">
                        {isSaving ? 'Duke ruajtur...' : 'Ruaj Të Dhënat'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileTab;