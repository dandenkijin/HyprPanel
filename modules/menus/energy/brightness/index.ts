import type { BoxWidget } from 'lib/types/widget.js';
import brightness from '../../../../services/Brightness.js';
import icons from '../../../icons/index.js';

const Brightness = (): BoxWidget => {
    // Map service value (0..1) <-> slider percent (0..100)
    const toPct = (v: number) => Math.max(0, Math.min(100, Math.round(v * 100)));
    const toUnit = (pct: number) => Math.max(0, Math.min(1, pct / 100));

    // Guard to prevent feedback loop during programmatic updates
    let updating = false;

    // Pre-create the slider so we can update it safely in hooks
    const slider = Widget.Slider({
        class_name: 'menu-active-slider menu-slider brightness',
        draw_value: false,
        hexpand: true,
        min: 0,
        max: 1,
        step: 0.01,
        value: typeof brightness.screen === 'number' ? Math.max(0, Math.min(1, brightness.screen)) : 0,
        setup: (self) => {
            // Initialize with current service value (0..1)
            const cur = typeof brightness.screen === 'number' ? Math.max(0, Math.min(1, brightness.screen)) : 0;
            self.value = cur;

            // Reflect service changes -> slider (avoid feedback loop)
            self.hook(brightness, (s) => {
                const svcRaw = brightness.screen;
                if (typeof svcRaw !== 'number' || Number.isNaN(svcRaw)) return;
                const svc = Math.max(0, Math.min(1, svcRaw));
                if (Math.abs(s.value - svc) > 0.0005) {
                    updating = true;
                    s.value = svc;
                    updating = false;
                }
            }, 'notify::screen');
        },
        on_change: (self) => {
            if (updating) return;
            const valRaw = self.value;
            if (typeof valRaw !== 'number' || Number.isNaN(valRaw)) return;
            const val = Math.max(0, Math.min(1, valRaw));
            const current = typeof brightness.screen === 'number' ? Math.max(0, Math.min(1, brightness.screen)) : 0;
            if (Math.abs(current - val) > 0.0005) {
                brightness.screen = val;
            }
        },
    });

    return Widget.Box({
        class_name: 'menu-section-container brightness',
        vertical: true,
        children: [
            Widget.Box({
                class_name: 'menu-label-container',
                hpack: 'fill',
                child: Widget.Label({
                    class_name: 'menu-label',
                    hexpand: true,
                    hpack: 'start',
                    label: 'Brightness',
                }),
            }),
            Widget.Box({
                class_name: 'menu-items-section',
                vpack: 'fill',
                vexpand: true,
                vertical: true,
                child: Widget.Box({
                    class_name: 'brightness-container',
                    children: [
                        Widget.Icon({
                            vexpand: true,
                            vpack: 'center',
                            class_name: 'brightness-slider-icon',
                            icon: icons.brightness.screen,
                        }),
                        Widget.Box({
                            class_name: 'slider-container',
                            vpack: 'center',
                            vexpand: true,
                            hexpand: true,
                            children: [slider],
                        }),
                        Widget.Label({
                            vpack: 'center',
                            vexpand: true,
                            class_name: 'brightness-slider-label',
                            // Derive percent directly from service (0..1)
                            label: brightness.bind('screen').as((b) => {
                                const v = typeof b === 'number' && !Number.isNaN(b) ? b : 0;
                                return `${toPct(v)}%`;
                            }),
                        }),
                    ],
                }),
            }),
        ],
    });
};

export { Brightness };
