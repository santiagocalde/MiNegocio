import { useMemo, useState, useEffect, useCallback } from 'react';
import { getDaysSince, formatDate } from '../utils/dateUtils';
import { apiGet } from '../services/apiClient';

function getStoredPlan() {
  try {
    const raw = localStorage.getItem('saas_business');
    if (raw) {
      const biz = JSON.parse(raw);
      if (biz && biz.plan) return { plan: biz.plan, created_at: null };
    }
  } catch {}
  return null;
}

export default function usePlan(businessConfig) {
  const [serverData, setServerData] = useState(() => getStoredPlan());
  const [retries, setRetries] = useState(0);

  const fetchPlan = useCallback(() => {
    apiGet('/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setServerData(data);
          localStorage.setItem('saas_plan_cache', JSON.stringify({ plan: data.plan, created_at: data.created_at }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    if (!serverData || serverData.plan === 'trial') {
      const timer = setTimeout(() => {
        if (retries < 5) {
          setRetries(r => r + 1);
          fetchPlan();
        }
      }, 2000 * (retries + 1));
      return () => clearTimeout(timer);
    }
  }, [serverData, retries, fetchPlan]);

  return useMemo(() => {
    const storedFallback = serverData?.plan ? serverData.plan : (getStoredPlan()?.plan || 'trial');
    const currentPlan = serverData?.plan || storedFallback;
    const planStartDate = serverData?.created_at || businessConfig?.plan_start_date || new Date().toISOString();
    const daysSinceStart = getDaysSince(planStartDate);
    const isTrialExpired = currentPlan === 'trial' && daysSinceStart > 7;
    const trialDaysRemaining = currentPlan === 'trial' ? Math.max(0, 7 - daysSinceStart) : 0;
    const trialEndDate = currentPlan === 'trial' ? new Date(new Date(planStartDate).getTime() + 7 * 86400000) : null;
    const trialEndDateFormatted = trialEndDate ? formatDate(trialEndDate) : '';

    const planLabel = { trial: 'Trial', simple: 'Simple', pro: 'Pro', ia: 'IA' }[currentPlan] || 'Trial';
    const canAccessIA = currentPlan === 'ia' || (currentPlan === 'trial' && !isTrialExpired);
    const isPaid = currentPlan === 'simple' || currentPlan === 'pro' || currentPlan === 'ia';
    const showGate = currentPlan === 'trial' && isTrialExpired && !isPaid;

    return {
      currentPlan, planStartDate, daysSinceStart, isTrialExpired,
      trialDaysRemaining, trialEndDate, trialEndDateFormatted,
      planLabel, canAccessIA, isPaid, showGate,
    };
  }, [businessConfig?.plan_start_date, serverData]);
}
