import { supabase } from '../supabase';

export const recalculateCosts = async (productIds: string[], method: 'cmp' | 'fifo' = 'cmp') => {
    try {
        const { data, error } = await supabase.functions.invoke('recalculate-costs', {
            body: { productIds, method }
        });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Error recalcuating costs:', err);
        throw err;
    }
};
