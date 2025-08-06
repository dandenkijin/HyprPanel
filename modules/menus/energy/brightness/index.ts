import type { BoxWidget } from 'lib/types/widget.js';
import brightness from '../../../../services/Brightness.js';
import icons from '../../../icons/index.js';

const Brightness = (): BoxWidget => {
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
                            children: [
                                Widget.Slider({
                                    class_name: 'menu-active-slider menu-slider brightness',
                                    draw_value: false,
                                    hexpand: true,
                                    min: 0,
                                    max: 1,
                                    value: 0, // Initial value, will be set by the binding
                                    setup: (self) => {
                                        // Set up the binding after the widget is created
                                        self.hook(brightness, (self) => {
                                            const value = brightness.screen;
                                            if (typeof value === 'number' && !Number.isNaN(value)) {
                                                self.value = Math.max(0, Math.min(1, value));
                                            }
                                        }, 'notify::screen');
                                    },
                                    on_change: (self) => {
                                        const value = self.value;
                                        if (typeof value === 'number' && !Number.isNaN(value)) {
                                            brightness.screen = value;
                                        }
                                    },
                                }),
                            ],
                        }),
                        Widget.Label({
                            vpack: 'center',
                            vexpand: true,
                            class_name: 'brightness-slider-label',
                            label: brightness.bind('screen').as((b) => `${Math.round(b * 100)}%`),
                        }),
                    ],
                }),
            }),
        ],
    });
};

export { Brightness };
