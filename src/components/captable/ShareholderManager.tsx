import React, { useState } from 'react';
import type { Shareholder, ShareholderRole } from '../../engine/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus, Trash2, Users, Edit2, Check, X } from 'lucide-react';

interface ShareholderManagerProps {
    shareholders: Shareholder[];
    onUpdate: (shareholders: Shareholder[]) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

export const ShareholderManager: React.FC<ShareholderManagerProps> = ({ shareholders, onUpdate, isCollapsed, onToggleCollapse }) => {
    const [newShareholderName, setNewShareholderName] = useState('');
    const [newShareholderRole, setNewShareholderRole] = useState<ShareholderRole>('Angel');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState<ShareholderRole>('Angel');

    const addShareholder = () => {
        if (!newShareholderName.trim()) return;
        const newId = Math.random().toString(36).substr(2, 9);
        onUpdate([...shareholders, { id: newId, name: newShareholderName, role: newShareholderRole }]);
        setNewShareholderName('');
    };

    const removeShareholder = (id: string) => {
        onUpdate(shareholders.filter(s => s.id !== id));
    };

    const startEditing = (shareholder: Shareholder) => {
        setEditingId(shareholder.id);
        setEditName(shareholder.name);
        setEditRole(shareholder.role);
    };

    const saveEditing = () => {
        if (!editingId || !editName.trim()) return;
        onUpdate(shareholders.map(s =>
            s.id === editingId ? { ...s, name: editName, role: editRole } : s
        ));
        setEditingId(null);
    };

    const cancelEditing = () => {
        setEditingId(null);
    };

    // Calculate summary for collapsed view
    const roleCounts = shareholders.reduce((acc, s) => {
        acc[s.role] = (acc[s.role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const summaryText = Object.entries(roleCounts)
        .map(([role, count]) => `${count} ${role}${count > 1 ? 's' : ''}`)
        .join(', ');

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Shareholders
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                        {shareholders.length} Total
                    </span>
                    {onToggleCollapse && (
                        <button
                            onClick={onToggleCollapse}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title={isCollapsed ? "Expand" : "Collapse"}
                        >
                            {isCollapsed ? <Plus className="w-4 h-4" /> : <X className="w-4 h-4 rotate-45" />}
                        </button>
                    )}
                </div>
            </div>

            {isCollapsed ? (
                <div className="text-sm text-slate-500">
                    {shareholders.length > 0 ? summaryText : "No shareholders added yet."}
                </div>
            ) : (
                <>
                    <div className="space-y-3 mb-6">
                        {shareholders.map((s) => (
                            <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group hover:border-blue-200 transition-colors">
                                {editingId === s.id ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 h-8 text-sm"
                                            autoFocus
                                        />
                                        <select
                                            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            value={editRole}
                                            onChange={(e) => setEditRole(e.target.value as ShareholderRole)}
                                        >
                                            <option value="Founder">Founder</option>
                                            <option value="Angel">Angel</option>
                                            <option value="VC">VC</option>
                                            <option value="Employee">Employee</option>
                                            <option value="Advisor">Advisor</option>
                                        </select>
                                        <button onClick={saveEditing} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button onClick={cancelEditing} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${s.role === 'Founder' ? 'bg-purple-100 text-purple-600' :
                                                s.role === 'VC' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'
                                                }`}>
                                                {s.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900">{s.name}</div>
                                                <div className="text-xs text-slate-500">{s.role}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => startEditing(s)}
                                                className="text-slate-400 hover:text-blue-500 p-2"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => removeShareholder(s.id)}
                                                className="text-slate-400 hover:text-red-500 p-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 items-end">
                        <Input
                            placeholder="New Shareholder Name"
                            value={newShareholderName}
                            onChange={(e) => setNewShareholderName(e.target.value)}
                            className="flex-1"
                        />
                        <select
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            value={newShareholderRole}
                            onChange={(e) => setNewShareholderRole(e.target.value as ShareholderRole)}
                        >
                            <option value="Founder">Founder</option>
                            <option value="Angel">Angel</option>
                            <option value="VC">VC</option>
                            <option value="Employee">Employee</option>
                            <option value="Advisor">Advisor</option>
                        </select>
                        <Button onClick={addShareholder} disabled={!newShareholderName}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
};
