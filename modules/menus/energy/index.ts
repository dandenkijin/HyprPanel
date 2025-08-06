import DropdownMenu from '../shared/dropdown/index.js';
import { Brightness } from './brightness/index.js';
import TLP from './tlp';
import TLP_Service from '../../../services/tlp';
import type { Attribute, Child } from 'lib/types/widget.js';
import type Window from 'types/widgets/window.js';
import options from 'options.js';

export default (): Window<Child, Attribute> => {
    return DropdownMenu({
        name: 'energymenu',
        transition: options.menus.transition.bind('value'),
        child: Widget.Box({
            class_name: 'menu-items energy',
            hpack: 'fill',
            hexpand: true,
            child: Widget.Box({
                vertical: true,
                hpack: 'fill',
                hexpand: true,
                class_name: 'menu-items-container energy',
                children: [
                    Brightness(),
                    TLP(TLP_Service)
                ],
            }),
        }),
    });
};
