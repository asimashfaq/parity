// Copyright 2015, 2016 Ethcore (UK) Ltd.
// This file is part of Parity.

// Parity is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Parity is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Parity.  If not, see <http://www.gnu.org/licenses/>.

import Push from 'push.js';
import BigNumber from 'bignumber.js';
import { noop } from 'lodash';

import { fromWei } from '~/api/util/wei';

import ethereumIcon from '~/../assets/images/contracts/ethereum-black-64x64.png';
import unkownIcon from '~/../assets/images/contracts/unknown-64x64.png';

export function notifyTransaction (account, token, _value, onClick) {
  const name = account.name || account.address;
  const value = token.tag.toLowerCase() === 'eth'
    ? fromWei(_value)
    : _value.div(new BigNumber(token.format || 1));

  const icon = token.tag.toLowerCase() === 'eth'
    ? ethereumIcon
    : (token.image || unkownIcon);

  Push.create(`${name}`, {
    body: `You just received ${value.toFormat()} ${token.tag.toUpperCase()}`,
    icon: {
      x16: icon,
      x32: icon
    },
    timeout: 20000,
    onClick: onClick || noop
  });
}