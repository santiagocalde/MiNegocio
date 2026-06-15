import { useMemo, useState, useEffect } from 'react';
import { getDaysSince, formatDate } from '../utils/dateUtils';
import { apiGet } from '../services/apiClient';

export default function usePlan(businessConfig) {
  const [serverDateStr, setServerDateStr] = useState(null);

  useEffect(() => {
    apiGet('/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.created_at) {
          setServerDateStr(data.created_at);
        }
      })
      .catch(() => {});
  }, []);

  return useMemo(() => {
    const currentPlan = businessConfig?.plan || 'trial';
    const planStartDate = serverDateStr || businessConfig?.plan_start_date || new Date().toISOString();
    const daysSinceStart = getDaysSince(planStartDate);
    const isTrialExpired = currentPlan === 'trial' && daysSinceStart > 7;
    const trialDaysRemaining = currentPlan === 'trial' ? Math.max(0, 7 - daysSinceStart) : 0;
    const trialEndDate = currentPlan === 'trial' ? new Date(new Date(planStartDate).getTime() + 7 * 86400000) : null;
    const trialEndDateFormatted = trialEndDate ? formatDate(trialEndDate) : '';

    const planLabel = { trial: 'Trial', pro: 'Pro', ia: 'IA' }[currentPlan] || 'Trial';
    const canAccessIA = currentPlan === 'ia' || (currentPlan === 'trial' && !isTrialExpired);
    const isPaid = currentPlan === 'pro' || currentPlan === 'ia';
    const showGate = currentPlan === 'trial' && isTrialExpired && !isPaid;

    return {
      currentPlan, planStartDate, daysSinceStart, isTrialExpired,
      trialDaysRemaining, trialEndDate, trialEndDateFormatted,
      planLabel, canAccessIA, isPaid, showGate,
    };
  }, [businessConfig?.plan, businessConfig?.plan_start_date, serverDateStr]);
}
