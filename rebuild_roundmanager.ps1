$header = Get-Content "src\components\captable\RoundManager.tsx.backup" | Select-Object -First 623

$investmentsSection = @'
                                            {capTable.shareholders.map(s => {
                                                const investment = round.investments.find(i => i.shareholderId === s.id);
                                                // Calculate shares if price is available
                                                const calculatedShares = (round.calculatedPricePerShare && round.calculatedPricePerShare > 0 && investment?.amount)
                                                    ? Math.floor(investment.amount / round.calculatedPricePerShare)
                                                    : null;

                                                return (
                                                    <div key={s.id} className="flex items-center justify-between text-sm gap-2">
                                                        <span className="text-slate-600 truncate w-24" title={s.name}>{s.name}</span>

                                                        <div className="flex gap-2 flex-1">
                                                            {/* Amount Input */}
                                                            <div className="relative flex-1">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                                                <FormattedInput
                                                                    placeholder="Amount"
                                                                    value={investment?.amount}
                                                                    onChange={(val) => updateInvestment(round.id, s.id, { amount: val })}
                                                                    className="w-full pl-4 pr-1 py-1 text-right border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                                                                />
                                                            </div>

                                                            {/* Shares Display (auto-calculated, read-only) */}
                                                            <div className="relative flex-1">
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">#</span>
                                                                <input
                                                                    type="text"
                                                                    value={calculatedShares !== null ? formatNumberInput(calculatedShares) : ''}
                                                                    readOnly
                                                                    placeholder="Shares"
                                                                    className="w-full pl-4 pr-1 py-1 text-right border border-slate-200 rounded outline-none text-xs bg-blue-50 text-blue-700 font-medium cursor-not-allowed"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Add New Investor Form */}
                                            {addingInvestorToRound === round.id ? (
                                                <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-3 space-y-2">
                                                    <div className="text-xs font-bold text-blue-900 mb-2">Add New Investor</div>
                                                    
                                                    {/* Name Input with Autocomplete */}
                                                    <div>
                                                        <label className="text-xs text-slate-600 block mb-1">Shareholder Name</label>
                                                        <input
                                                            type="text"
                                                            value={newInvestorName}
                                                            onChange={(e) => setNewInvestorName(e.target.value)}
                                                            placeholder="Enter name"
                                                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                            autoFocus
                                                            list={`shareholders-${round.id}`}
                                                        />
                                                        <datalist id={`shareholders-${round.id}`}>
                                                            {capTable.shareholders.map(s => (
                                                                <option key={s.id} value={s.name} />
                                                            ))}
                                                        </datalist>
                                                    </div>

                                                    {/* Role Selector */}
                                                    <div>
                                                        <label className="text-xs text-slate-600 block mb-1">Role</label>
                                                        <select
                                                            value={newInvestorRole}
                                                            onChange={(e) => setNewInvestorRole(e.target.value as any)}
                                                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                        >
                                                            <option value="Angel">Angel</option>
                                                            <option value="VC">VC</option>
                                                            <option value="Founder">Founder</option>
                                                            <option value="Employee">Employee</option>
                                                            <option value="Advisor">Advisor</option>
                                                        </select>
                                                    </div>

                                                    {/* Amount Input */}
                                                    <div>
                                                        <label className="text-xs text-slate-600 block mb-1">Investment Amount</label>
                                                        <div className="relative">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                                            <FormattedInput
                                                                value={newInvestorAmount}
                                                                onChange={setNewInvestorAmount}
                                                                placeholder="0"
                                                                className="w-full pl-5 pr-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex gap-2 pt-2">
                                                        <button
                                                            onClick={() => saveNewInvestor(round.id)}
                                                            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={cancelAddingInvestor}
                                                            className="flex-1 px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-300 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startAddingInvestor(round.id)}
                                                    className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add Investor
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-3 bg-slate-50 border-t border-slate-200 rounded-b-xl text-center mt-auto">
                                        <div className="text-xs text-slate-500">Post-Money</div>
                                        <div className="font-bold text-slate-700">
                                            {formatCurrency((round.preMoneyValuation || 0) + round.investments.reduce((acc, i) => acc + i.amount, 0))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <button
                        onClick={addRound}
                        className="w-12 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>
    );
};
'@

$header + $investmentsSection | Set-Content "src\components\captable\RoundManager.tsx"
