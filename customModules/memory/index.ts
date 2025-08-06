import options from 'options';
import { module } from '../module';

import { calculateMemoryUsage } from './computeMemory';
import { formatTooltip, inputHandler, renderResourceLabel } from 'customModules/utils';
import { BarBoxChild, ResourceLabelType } from 'lib/types/bar';
import { pollVariable } from 'customModules/PollVar';
import Button from 'types/widgets/button';
import { LABEL_TYPES } from 'lib/types/defaults/bar';
import { Attribute, Child } from 'lib/types/widget';

const {
    ramLabel, 
    swapLabel,
    ramLabelType, 
    swapLabelType,
    round, 
    leftClick, 
    rightClick, 
    middleClick, 
    pollingInterval,
    ramIcon,
    swapIcon
} = options.bar.customModules.memory;

type MemoryData = {
    ram: {
        total: number;
        used: number;
        free: number;
        percentage: number;
    };
    swap: {
        total: number;
        used: number;
        free: number;
        percentage: number;
    };
};

const defaultMemoryData = {
    ram: { total: 0, used: 0, free: 0, percentage: 0 },
    swap: { total: 0, used: 0, free: 0, percentage: 0 }
};

const memoryUsage = Variable<MemoryData>(defaultMemoryData);

pollVariable(memoryUsage, [round.bind('value')], pollingInterval.bind('value'), calculateMemoryUsage, round);

export const Memory = (): BarBoxChild => {
    const memoryModule = module({
        textIcon: Utils.merge(
            [memoryUsage.bind('value')],
            (mem: MemoryData) => {
                return mem.ram.percentage > 80 ? ramIcon.value : swapIcon.value;
            }
        ),
        label: Utils.merge(
            [memoryUsage.bind('value'), ramLabelType.bind('value'), swapLabelType.bind('value'), round.bind('value')],
            (mem: MemoryData, ramLblTyp: ResourceLabelType, swapLblTyp: ResourceLabelType, round: boolean) => {
                const ramText = renderResourceLabel(ramLblTyp, mem.ram, round);
                const swapText = renderResourceLabel(swapLblTyp, mem.swap, round);
                return `${ramLabel.value ? ramText : ''} ${swapLabel.value ? swapText : ''}`.trim();
            },
        ),
        tooltipText: Utils.merge(
            [memoryUsage.bind('value'), ramLabelType.bind('value'), swapLabelType.bind('value')],
            (mem: MemoryData, ramLblTyp: ResourceLabelType, swapLblTyp: ResourceLabelType) => {
                const ramTooltip = formatTooltip('RAM', ramLblTyp);
                const swapTooltip = formatTooltip('Swap', swapLblTyp);
                return `${ramTooltip}\n${swapTooltip}`;
            },
        ),
        boxClass: 'memory',
        showLabelBinding: Variable(true), // Always show if both are enabled
        props: {
            setup: (self: Button<Child, Attribute>) => {
                inputHandler(self, {
                    onPrimaryClick: { cmd: leftClick },
                    onSecondaryClick: { cmd: rightClick },
                    onMiddleClick: { cmd: middleClick },
                    onScrollUp: {
                        fn: () => {
                            ramLabelType.value = LABEL_TYPES[
                                (LABEL_TYPES.indexOf(ramLabelType.value) + 1) % LABEL_TYPES.length
                            ] as ResourceLabelType;
                        },
                    },
                    onScrollDown: {
                        fn: () => {
                            ramLabelType.value = LABEL_TYPES[
                                (LABEL_TYPES.indexOf(ramLabelType.value) - 1 + LABEL_TYPES.length) % LABEL_TYPES.length
                            ] as ResourceLabelType;
                        },
                    },
                });
            },
        },
    });

    return memoryModule;
};