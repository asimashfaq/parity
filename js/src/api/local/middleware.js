// Copyright 2015-2017 Parity Technologies (UK) Ltd.
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

import EthereumTx from 'ethereumjs-tx';
import accounts from './accounts';
import dictionary from './dictionary';
import { Middleware } from '../transport';
import { toHex } from '../util/format';
import { inNumber16 } from '../format/input';
import { phraseToWallet, phraseToAddress } from './ethkey';

// Maps transaction requests to transaction hashes.
// This allows the locally-signed transactions to emulate the signer.
const transactionHashes = {};
const transactions = {};

// Current transaction id. This doesn't need to be stored, as it's
// only relevant for the current the session.
let transactionId = 1;

function randomWord () {
  const index = Math.random() * dictionary.length | 0;

  return dictionary[index];
}

function randomPhrase (length) {
  const words = [];

  while (length--) {
    words.push(randomWord());
  }

  return words.join(' ');
}

export default class LocalAccountsMiddleware extends Middleware {
  constructor (transport) {
    super(transport);

    const register = this.register.bind(this);

    register('eth_accounts', () => {
      return accounts.mapArray((account) => account.address);
    });

    register('eth_coinbase', () => {
      return accounts.lastUsed();
    });

    register('parity_accountsInfo', () => {
      return accounts.mapObject(({ name }) => {
        return { name };
      });
    });

    register('parity_allAccountsInfo', () => {
      return accounts.mapObject(({ name, meta, uuid }) => {
        return { name, meta, uuid };
      });
    });

    register('parity_checkRequest', ([id]) => {
      return transactionHashes[id] || Promise.resolve(null);
    });

    register('parity_defaultAccount', () => {
      return accounts.lastUsed();
    });

    register('parity_generateSecretPhrase', () => {
      return randomPhrase(12);
    });

    register('parity_getNewDappsAddresses', () => {
      return [];
    });

    register('parity_hardwareAccountsInfo', () => {
      return {};
    });

    register('parity_newAccountFromPhrase', ([phrase, password]) => {
      return phraseToWallet(phrase)
        .then((wallet) => {
          return accounts.create(wallet, password);
        });
    });

    register('parity_setAccountMeta', ([address, meta]) => {
      accounts.get(address).meta = meta;

      return true;
    });

    register('parity_setAccountName', ([address, name]) => {
      accounts.get(address).name = name;

      return true;
    });

    register('parity_postTransaction', ([transaction]) => {
      if (transaction.from == null) {
        transaction.from = accounts.lastUsed();
      }

      transaction.nonce = null;
      transaction.condition = null;

      const id = toHex(transactionId++);

      transactions[id] = { sendTransaction: transaction };

      return id;

      // return this
      //   .rpcRequest('parity_nextNonce', [from])
      //   .then((nonce) => {
      //     const account = accounts.get(from);
      //     const tx = new EthereumTx({
      //       nonce,
      //       gasLimit,
      //       gasPrice,
      //       to,
      //       value,
      //       data
      //     });

      //     const id = toHex(transactionId++);

      //     tx.sign(account.privateKey);
      //     const serializedTx = `0x${tx.serialize().toString('hex')}`;
      //     return this.rpcRequest('eth_sendRawTransaction', [serializedTx]);
      //   });
    });

    register('parity_phraseToAddress', ([phrase]) => {
      return phraseToAddress(phrase);
    });

    register('parity_useLocalAccounts', () => {
      return true;
    });

    register('parity_listGethAccounts', () => {
      return [];
    });

    register('parity_listRecentDapps', () => {
      return {};
    });

    register('parity_killAccount', ([address, password]) => {
      accounts.remove(address);

      return true;
    });

    register('signer_confirmRequest', ([id, modify, password]) => {
      const {
        gasPrice,
        gas: gasLimit,
        from,
        to,
        value,
        data
      } = Object.assign(transactions[id].sendTransaction, modify);

      return this
        .rpcRequest('parity_nextNonce', [from])
        .then((nonce) => {
          const tx = new EthereumTx({
            nonce,
            to,
            data,
            gasLimit: inNumber16(gasLimit),
            gasPrice: inNumber16(gasPrice),
            value: inNumber16(value)
          });
          const account = accounts.get(from);

          tx.sign(account.decryptPrivateKey(password));

          const serializedTx = `0x${tx.serialize().toString('hex')}`;

          return this.rpcRequest('eth_sendRawTransaction', [serializedTx]);
        })
        .then((hash) => {
          console.log('hash', hash);

          delete transactions[id];

          transactionHashes[id] = hash;

          return {};
        });
    });

    register('signer_requestsToConfirm', () => {
      return Object.keys(transactions).map((id) => {
        return {
          id,
          origin: {},
          payload: transactions[id]
        };
      });
      // {"id":"0x1","origin":{"signer":"0x5eca04dfb2540c6d491bcf8c95d541033d32ff8c1eb53d9d5ad8b539404deedd"},"payload":{"sendTransaction":{"condition":null,"data":"0x","from":"0x00a329c0648769a73afac7f9381e08fb43dbea72","gas":"0x5208","gasPrice":"0x0","nonce":null,"to":"0x003dd508237dd9784497b651beebea1a0841a402","value":"0x3635c9adc5dea00000"}}}
    });
  }
}
