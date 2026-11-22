import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, FilePlus2, Target, TrendingUp } from 'lucide-react';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  computeMonthlyTrends,
  computeOverviewMetrics,
  computeQuarterlyTrends,
} from '../lib/analytics';
import { formatPeriodLabel, getStatusColor } from '../lib/kpiMath';
import type { NavSection } from '../types/kpi';

interface DepartmentsViewProps {
  onNavigate: (section: NavSection) => void;
  onQuickCreateForDept: (departmentId: string) => void;
}

export function DepartmentsView({ onNavigate, onQuickCreateForDept }: DepartmentsViewProps) {
  const { isEditor, isSuperAdmin } = useAuth();
  const { departments, definitions, records } = useData();

  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [periodTab, setPeriodTab] = useState<'All' | 'Monthly' | 'Quarterly' | 'Annual'>('All');

  const activeDept = useMemo(() => {
    if (selectedDeptId) {
      const found = departments.find((d) => d.id === selectedDeptId);
      if (found) return found;
    }
    return departments[0] || null;
  }, [departments, selectedDeptId]);

  const deptRecords = useMemo(() => {
    if (!activeDept) return [];
    return records.filter(
      (r) =>
        r.departmentId === activeDept.id &&
        (periodTab === 'All' || r.reportingPeriod === periodTab)
    );
  }, [activeDept, records, periodTab]);

  const allDeptRecords = useMemo(
    () => (activeDept ? records.filter((r) => r.departmentId === activeDept.id) : []),
    [activeDept, records]
  );

  const employeeRecords = useMemo(
    () => deptRecords.filter((r) => r.isEmployeeSpecific && r.employeeName),
    [deptRecords]
  );

  const deptDefs = useMemo(
    () => (activeDept ? definitions.filter((def) => def.departmentId === activeDept.id) : []),
    [activeDept, definitions]
  );

  const metrics = useMemo(() => computeOverviewMetrics(deptRecords), [deptRecords]);
  const monthlyData = useMemo(() => computeMonthlyTrends(allDeptRecords), [allDeptRecords]);
  const quarterlyData = useMemo(() => computeQuarterlyTrends(allDeptRecords), [allDeptRecords]);

  if (departments.length === 0) {
    return (
      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-10 text-center space-y-4 shadow-xl">
        <Building2 className="w-10 h-10 text-[#FACC15] mx-auto animate-bounce" />
        <h2 className="text-xl font-bold text-white font-display">No Departments Accessible</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          {isSuperAdmin
            ? 'No departments have been configured yet. Create departments inside Department Management.'
            : 'No departments are currently assigned to your user profile. Contact a Super Administrator.'}
        </p>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => onNavigate('department_management')}
            className="px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold cursor-pointer"
          >
            Manage Departments
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Department Workspaces
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Isolated operational workspaces, targets, and historical performance per department
          </p>
        </div>

        {isEditor && activeDept && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onQuickCreateForDept(activeDept.id)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg shadow-[#FACC15]/10"
          >
            <FilePlus2 className="w-4 h-4" />
            Enter KPI for {activeDept.code}
          </motion.button>
        )}
      </div>

      {/* Smooth Department Switcher Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {departments.map((d) => {
          const isSelected = activeDept?.id === d.id;
          return (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={d.id}
              type="button"
              onClick={() => setSelectedDeptId(d.id)}
              className={`px-4 py-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#FACC15] text-black border-[#FACC15] font-semibold shadow-md'
                  : 'bg-[#0F1115] text-zinc-300 border-white/8 hover:border-[#FACC15]/40 hover:text-white'
              }`}
            >
              {d.code} · {d.name} {!d.isActive && '(Inactive)'}
            </motion.button>
          );
        })}
      </div>

      {activeDept && (
        <motion.div
          key={activeDept.id}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Department Summary Header */}
          <div className="bg-[#0F1115] border border-white/8 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1.5 max-w-2xl">
              <div className="text-xs text-[#D4AF37] font-medium">
                {activeDept.code} · {activeDept.isActive ? 'Active Department' : 'Inactive Department'}
              </div>
              <h2 className="text-2xl font-bold text-white font-display">{activeDept.name}</h2>
              <p className="text-sm text-zinc-400">
                {activeDept.description || 'Departmental KPI tracking and performance evaluation workspace.'}
              </p>
              {activeDept.headName && (
                <p className="text-xs text-zinc-500 pt-1">
                  Department Head: <span className="text-zinc-300">{activeDept.headName}</span>
                  {activeDept.headEmail ? ` · ${activeDept.headEmail}` : ''}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-6 border-t lg:border-t-0 lg:border-l border-white/8 pt-4 lg:pt-0 lg:pl-8 shrink-0">
              <div>
                <div className="text-xs text-zinc-400">Avg Achievement</div>
                <div className="text-2xl font-bold text-[#FACC15] mt-1 font-display">
                  <AnimatedCounter value={metrics.avgAchievement} decimals={1} suffix="%" />
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">KPI Records</div>
                <div className="text-2xl font-bold text-white mt-1 font-display">
                  <AnimatedCounter value={metrics.totalKpis} />
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">Configured Targets</div>
                <div className="text-2xl font-bold text-white mt-1 font-display">
                  <AnimatedCounter value={deptDefs.length} />
                </div>
              </div>
            </div>
          </div>

          {/* Period Scope Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#0F1115] border border-white/8 rounded-lg">
              {(['All', 'Monthly', 'Quarterly', 'Annual'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPeriodTab(tab)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    periodTab === tab
                      ? 'bg-[#FACC15] text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab} Records
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-[#FACC15] hover:underline cursor-pointer"
            >
              Generate Department Report
            </button>
          </div>

          {/* Departmental Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 shadow-xl">
              <div className="flex items-center gap-2 text-sm font-bold text-white font-display mb-4">
                <TrendingUp className="w-4 h-4 text-[#FACC15]" />
                Monthly Performance Trajectory
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgAchievement"
                      name="Achievement %"
                      stroke="#FACC15"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#FACC15' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 shadow-xl">
              <div className="flex items-center gap-2 text-sm font-bold text-white font-display mb-4">
                <Target className="w-4 h-4 text-[#D4AF37]" />
                Quarterly Comparative Achievement
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="avgAchievement"
                      name="Achievement %"
                      fill="#D4AF37"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Configured Departmental Targets */}
          <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-white/8">
              <h3 className="text-base font-bold text-white font-display">
                Configured Departmental KPI Targets ({deptDefs.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] font-medium text-zinc-400 bg-[#0B0D11]">
                    <th className="py-3 px-4">KPI Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Cadence</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Target Baseline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-[13px]">
                  {deptDefs.map((def) => (
                    <tr key={def.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-medium text-zinc-100">{def.title}</td>
                      <td className="py-3 px-4 text-zinc-400">{def.categoryName}</td>
                      <td className="py-3 px-4 text-zinc-300">{def.defaultPeriodType}</td>
                      <td className="py-3 px-4 text-zinc-400 text-xs">
                        {def.calculationMethod === 'lower_is_better'
                          ? 'Lower is Better'
                          : 'Higher is Better'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-[#FACC15]">
                        {def.defaultTarget.toLocaleString()} {def.unit}
                      </td>
                    </tr>
                  ))}
                  {deptDefs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-zinc-500">
                        No predefined KPI targets configured for this department yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employee-Wise KPI Performance Breakdown */}
          {employeeRecords.length > 0 && (
            <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                <h3 className="text-base font-bold text-white font-display">
                  Employee-Wise Performance Breakdown ({employeeRecords.length})
                </h3>
                <span className="text-xs text-[#FACC15]">Individual Employee KPIs</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/8 text-[11px] font-medium text-zinc-400 bg-[#0B0D11]">
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-4">KPI Title</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4 text-right">Achievement</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6 text-[13px]">
                    {employeeRecords.map((r) => {
                      const st = getStatusColor(r.status);
                      return (
                        <tr key={r.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-semibold text-[#FACC15]">{r.employeeName}</td>
                          <td className="py-3 px-4 font-medium text-zinc-100">{r.kpiTitle}</td>
                          <td className="py-3 px-4 font-mono-tabular text-xs text-zinc-300">
                            {formatPeriodLabel(r)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#FACC15]">
                            {r.achievementPct.toFixed(1)}%
                          </td>
                          <td className={`py-3 px-4 text-xs font-medium ${st.text}`}>{r.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Departmental Historical Records */}
          <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-white/8">
              <h3 className="text-base font-bold text-white font-display">
                Department Historical KPI Records ({deptRecords.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] font-medium text-zinc-400 bg-[#0B0D11]">
                    <th className="py-3 px-4">KPI Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4 text-right">Target</th>
                    <th className="py-3 px-4 text-right">Actual</th>
                    <th className="py-3 px-4 text-right">Achievement</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-[13px]">
                  {deptRecords.map((r) => {
                    const st = getStatusColor(r.status);
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-medium text-zinc-100">{r.kpiTitle}</td>
                        <td className="py-3 px-4 text-zinc-400">{r.categoryName}</td>
                        <td className="py-3 px-4 font-mono-tabular text-xs text-zinc-300">
                          {formatPeriodLabel(r)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-zinc-300">
                          {r.targetValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-zinc-100">
                          {r.actualValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#FACC15]">
                          {r.achievementPct.toFixed(1)}%
                        </td>
                        <td className={`py-3 px-4 text-xs font-medium ${st.text}`}>{r.status}</td>
                      </tr>
                    );
                  })}
                  {deptRecords.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                        No {periodTab === 'All' ? '' : periodTab.toLowerCase()} KPI records submitted for {activeDept.name} yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
