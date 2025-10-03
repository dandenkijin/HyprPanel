const GLib = imports.gi.GLib;

import { divide } from 'customModules/utils';
import type { GenericResourceData } from 'lib/types/customModules/generic';
import type { Variable as VariableType } from 'types/variable';

export const calculateMemoryUsage = (round: VariableType<boolean>): {ram: GenericResourceData, swap: GenericResourceData} => {
    try {
        const [success, meminfoBytes] = GLib.file_get_contents('/proc/meminfo');

        if (!success || !meminfoBytes) {
            throw new Error('Failed to read /proc/meminfo or file content is null.');
        }

        const meminfo = new TextDecoder('utf-8').decode(meminfoBytes);

        // RAM calculations
        const totalRamMatch = meminfo.match(/MemTotal:\s+(\d+)/);
        const availableRamMatch = meminfo.match(/MemAvailable:\s+(\d+)/);
        
        // Swap calculations
        const totalSwapMatch = meminfo.match(/SwapTotal:\s+(\d+)/);
        const freeSwapMatch = meminfo.match(/SwapFree:\s+(\d+)/);

        if (!totalRamMatch || !availableRamMatch || !totalSwapMatch || !freeSwapMatch) {
            throw new Error('Failed to parse /proc/meminfo for memory values.');
        }

        // Convert KB to bytes
        const convert = (kb: string) => Number.parseInt(kb, 10) * 1024;

        // RAM data
        const totalRam = convert(totalRamMatch[1]);
        const availableRam = convert(availableRamMatch[1]);
        let usedRam = totalRam - availableRam;
        usedRam = Number.isNaN(usedRam) || usedRam < 0 ? 0 : usedRam;

        // Swap data
        const totalSwap = convert(totalSwapMatch[1]);
        const freeSwap = convert(freeSwapMatch[1]);
        const usedSwap = totalSwap - freeSwap;

        return {
            ram: {
                total: totalRam,
                used: usedRam,
                free: availableRam,
                percentage: divide([totalRam, usedRam], round.value)
            },
            swap: {
                total: totalSwap,
                used: usedSwap,
                free: freeSwap,
                percentage: divide([totalSwap, usedSwap], round.value)
            }
        };
    } catch (error) {
        console.error('Error calculating memory usage:', error);
        const zeroData = { total: 0, used: 0, percentage: 0, free: 0 };
        return { ram: zeroData, swap: zeroData };
    }
};