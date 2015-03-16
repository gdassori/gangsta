// gangsta double spending tool
// github.com/gdassori/gangsta

gangsta = new Object

gangsta.init = function() {
    gangsta.debug = false
    gangsta.errors = []
    gangsta.wallet = []
    gangsta.transactions = {}
    gangsta.data = {'flood_alerted': 0, 'backend_available': false, 'wallet_service': 'blockr'};
    requirejs(['/js/services/' + gangsta.data['wallet_service'] + '.js'])
}
gangsta.validatePubKey = function(addr) {
    try {
        return new bitcoin.Address.fromBase58Check(addr)
    } catch(e) {
        return false
    }
}
gangsta.getAddressIndex = function(addr) {
    var res = null
    i = 0
    $.each(gangsta.wallet, function() {
         if (this['pub'] == addr) {
            res = i
            return false
         }
         i += 1
    })
    return res
}

gangsta.populate_wallet = function(cb) {
    var res = $("#keys_import_area").val().replace(/\n/g, " ").replace(/;/g, " ").replace(/,/g, " ").replace(/#/g, " ").split(" ")
    var import_key = function(base58key) {
        try {
            return new bitcoin.ECKey.fromWIF(base58key)
        } catch(e) {
            return null
        }
    }
    var i = 0
    $.each(res, function() {
        var key = (([51, 52].indexOf(String(this).length)) >= 0) ? import_key(String(this)) : null
        if (key != null) {
                i += 1
                if (i <= 20) {
                    gangsta.wallet.push({'key': key,
                                         'pub': key.pub.getAddress().toString(),
                                         'transactions':[],
                                         'balance': null,
                                         'nb_txs': null})
                 } else {
                    alert('more than 20 keys found. gangsta will import max 20 keys')
                    if (cb) cb()
                    return false
                 }
             }
        })
    if (gangsta.wallet.length > 0 && cb) cb()
    else alert('no valid private keys found')
}
gangsta.get_wallet_details = function(cb) {
     var success_cb = function(res) {
         if (res['status'] == 'success') {
             var total_balance = 0
             if (gangsta.wallet.length == 1)  data = [res['data']]
             else if (gangsta.wallet.length > 1)  data = res['data']
             $.each(data, function() {
                 for (var i = 0; i < gangsta.wallet.length; i++) {
                     if (gangsta.wallet[i]['pub'] == this['address']) {
                         gangsta.wallet[i]['balance'] = this['balance']
                         gangsta.wallet[i]['nb_txs'] = this['nb_txs']
                         break
                     }
                 }
             })
             if (x == addresses.length && cb) cb()
             x += 1
         } else {
             gangsta.handleErrors('error fetching data')
         }
     }
     var addrs_string = ''
     var addresses = []
     var i = 0
     $.each(gangsta.wallet, function() {
         addrs_string += i > 0 ? "," : ""
         addrs_string += this['pub']
         i += 1
         if (i / 20 == parseInt(i/20)) {
            addresses.push(addrs_string)
            addrs_string = ''
            i = 0
         }
     })
     if (i != 0) addresses.push(addrs_string)
     i = 0;
     var x = 1;
     $.each(addresses, function() {
        var addrs = this
        setTimeout(function() {
            wallet_service.get_wallet_details(addrs).then(success_cb, gangsta.handleErrors)
        }, i * 1000);
        i += 1
    })
}
gangsta.get_current_block = function() {
    var success_cb = function(res) {
        if (res['status'] == 'success') {
            var prev_block = gangsta.data['current_block']
            gangsta.data['current_block'] = res['data']['nb']
            gangsta.data['current_block_timestamp'] = res['data']['time_utc']
            var ago = parseInt(((new Date().getTime()) - new Date(gangsta.data['current_block_timestamp']).getTime()) / 60000)
            if (ago < 1) var ago_str = "< 1 min ago"
            else if (ago >= 1) var ago_str = "~ " + ago + " min" + ((ago > 1) ? 's' : '') + " ago"
            $(".blockchain_current_block").text(String(gangsta.data['current_block']) + ", " + ago_str)
            setTimeout(function() { gangsta.get_current_block() }, 60000)
            if (gangsta.data['current_block'] != prev_block) {
                gangsta.on_new_block()
            }
        }
        else {
            gangsta.handleErrors('error fetching block: ' + res)
        }
    };
    wallet_service.get_current_block().then(success_cb, gangsta.handleErrors);
};
gangsta.on_new_block = function() {
    console.log('new block')
    var addrs = gangsta.addresses_with_unconfirmed_txs()
    gangsta.get_transactions(addrs, function() {
        gangsta.show_transactions(false, addrs)
        gangsta.set_last_check(true)
    })
    // check on prev unconfirmed fetched txs (only on wallet, not txs details, which will be fetched, if needed),
    // when the tx is shown cause of 'at_block' param
}
gangsta.addresses_with_unconfirmed_txs = function() {
    var addresses_involved = []
    $.each(gangsta.wallet, function() {
        var addr =  this['pub']
        $.each(this['transactions'], function() {
            if (this['confirms'] == 0) {
                if (addresses_involved.indexOf(addr) == -1) addresses_involved.push(addr)
            }
        })
    })
    return addresses_involved
}

gangsta.unconfirmed_become_confirmed = function(txid, addr) {
    if (!addr) {
        var tx = gangsta.transactions[txid]['transaction']
        gangsta.wallet[tx]
        addresses_involved = []
        $.each(tx['data']['vins'], function() {
            if (gangsta.getAddressIndex(this['address']) && (addresses_involved.indexOf(this['address']) == -1)) addresses_involved.push(this['address'])
        })
        $.each(tx['data']['vouts'], function() {
            if (gangsta.getAddressIndex(this['address']) && (addresses_involved.indexOf(this['address']) == -1)) addresses_involved.push(this['address'])
        })
    } else {
        addresses_involved=[addr]
    }
    gangsta.get_transactions(addresses_involved, function() {
        gangsta.show_transactions(false, addresses_involved)
    })
    if (gangsta.transactions.hasOwnProperty(txid)) {
        gangsta.get_tx(txid, function() {
            gangsta.update_show_edit_transaction(txid)
        })
    }
}
gangsta.drop_transaction_from_wallet = function(addr, txid) {
    var i = 0
    var index = gangsta.getAddressIndex(addr)
    $.each(gangsta.wallet[index]['transactions'], function() {
        if (this['tx'] == txid) {
            var pos = gangsta.wallet[index]['transactions'].indexOf(this)
            gangsta.wallet[index]['transactions'].splice(pos, 1)
        }
    })
}
gangsta.get_transactions = function(addrs, cb) {
    if (addrs) {
        var addrs_with_txs = addrs
    } else {
        // fetch txs for the entire wallet if transactions are expected
        var addrs_with_txs = []
        $.each(gangsta.wallet, function() {
            if (this['nb_txs'] > 0) {
                addrs_with_txs.push(this['pub'])
            }
        })
        if (addrs_with_txs.length == 0) {
            console.log('no addr with expected txs')
            return false // kill
        }
    }
    var addrs_string = ''
    var addresses = []
    var i = 0
    $.each(addrs_with_txs, function() {
        addrs_string += i > 0 ? "," : ""
        addrs_string += String(this)
        i += 1
        if (i / 10 == parseInt(i/10)) {
            addresses.push(addrs_string)
            addrs_string = ''
            i = 0
         }
    })
    if (i != 0) addresses.push(addrs_string)
    i = 0
    var x = 1;
    $.each(addresses, function() {
        var addrs = this
        setTimeout(function() {
            var success_cb = function(res) {
                var parseDataElement = function(data) {
                    var addr = data['address']
                    if (data.hasOwnProperty('unconfirmed')) {
                        $.each(data['unconfirmed'], function() {
                            gangsta.drop_transaction_from_wallet(addr, this['tx'])
                            gangsta.wallet[gangsta.getAddressIndex(addr)]['transactions'].push({'tx': this['tx'], 'confirms': 0, 'amount': this['amount'], 'time': parseInt(new Date(this['time_utc']).getTime()/1000)})
                        })
                    } else if (data.hasOwnProperty('txs')) {
                        $.each(data['txs'], function() {
                            gangsta.drop_transaction_from_wallet(addr, this['tx'])
                            gangsta.wallet[gangsta.getAddressIndex(addr)]['transactions'].push({'tx': this['tx'], 'confirms': this['confirmations'], 'amount': this['amount'], 'time': parseInt(new Date(this['time_utc']).getTime()/1000)})
                        })
                    }
                }
                if (res['status'] == 'success') {
                    if (addrs_with_txs.length > 1) {
                        $.each(res['data'], function() {
                            parseDataElement(this)
                        })
                    } else {
                        parseDataElement(res['data'])
                    }
                    if (x == addresses.length*2 && cb) cb()
                    x += 1
                } else {
                    gangsta.handleErrors(res)
                }
            }
            wallet_service.get_txs(addrs).then(success_cb, gangsta.handleErrors);
            wallet_service.get_unconfirmed_txs(addrs).then(success_cb, gangsta.handleErrors)
        }, i * 2000)
        i += 1
    })
};
gangsta.get_tx = function(txid, cb) {
    var success_cb = function(res) {
        if (res['status'] == 'success') {
            var prev_tx = gangsta.transactions[txid];
            gangsta.transactions[txid] = {'at_block': gangsta.data['current_block'], 'transaction': res }
            if (cb) cb()
        } else {
            gangsta.handleErrors('error on fetched data for transaction: ' + res)
        }
    };
    wallet_service.get_tx(txid).then(success_cb, gangsta.handleErrors)
}
gangsta.check_unconfirmed_on_addresses = function(single_call) {
    // loop looking for new txs
    // TODO announcer with crossbar backend ?
    var addrs_string = ''
    var i = 0
    var addresses = []
    $.each(gangsta.wallet, function() {
        addrs_string += i > 0 ? "," : ""
        addrs_string += this['pub']
        i += 1
        if (i / 20 == parseInt(i/20)) {
            addresses.push(addrs_string)
            addrs_string = ''
            i = 0
         }
    })
    if (i != 0) addresses.push(addrs_string)
    i = 0
    var x = 1;
    $.each(addresses, function() {
         var addrs = this
         setTimeout(function() {
            var success_cb = function(res) {
                if (res['status'] == 'success') {
                    var fetched_unconfirmed = []
                    if (addrs.length > 1) {
                        $.each(res['data'], function() {
                            var addr = this['address']
                            var new_txs = false
                            var seen_txs = []
                            $.each(gangsta.wallet[gangsta.getAddressIndex(addr)]['transactions'], function() {
                                seen_txs.push(this['tx'])
                            })
                            $.each(this['unconfirmed'], function() {
                                fetched_unconfirmed.push(this['tx'])
                                if (seen_txs.indexOf(this['tx']) == -1) {
                                    new_txs = true
                                    gangsta.wallet[gangsta.getAddressIndex(addr)]['transactions'].unshift({'tx': this['tx'], 'confirms': 0, 'amount': this['amount'], 'time': parseInt(new Date(this['time_utc']).getTime()/1000)})
                                }
                            })
                            if (new_txs) gangsta.on_new_transaction(addr)
                            gangsta.data['last_unconfirmed_check'] = new Date().getTime()
                            gangsta.set_last_check(false)
                         })
                     } else {
                        var addr = res['data']['address']
                        var new_txs = false
                        var seen_txs = []
                        fetched_unconfirmed.push(res['data']['tx'])
                        $.each(gangsta.wallet[gangsta.getAddressIndex(addr)]['transactions'], function() {
                            seen_txs.push(this['tx'])
                        })
                        $.each(res['data']['unconfirmed'], function() {
                            if (seen_txs.indexOf(this['tx']) == -1) {
                                new_txs = true
                                gangsta.wallet[gangsta.getAddressIndex(addr)]['transactions'].unshift({'tx': this['tx'], 'confirms': 0, 'amount': this['amount'], 'time': parseInt(new Date(this['time_utc']).getTime()/1000)})
                            }
                        })
                        if (new_txs) gangsta.on_new_transaction(addr)
                        gangsta.data['last_unconfirmed_check'] = new Date().getTime()
                        gangsta.set_last_check(false)
                     }
                     $.each(gangsta.wallet, function() {
                        $.each(this['transactions'], function() {
                            if ((this['confirms'] == 0) && fetched_unconfirmed.indexOf(this['tx']) == -1) {
                                gangsta.unconfirmed_become_confirmed(this['tx'], addr)
                            }
                        })
                     })
                 } else {
                    gangsta.handleErrors(data)
                }
            };
            wallet_service.get_unconfirmed_txs(addrs).then(success_cb, gangsta.handleErrors)
         }, i * 3000)
         i += 1
    })
    if (!single_call) {
        setTimeout(function() {
            gangsta.check_unconfirmed_on_addresses()
        }, 120000)
    }
}
gangsta.on_new_transaction = function(addr) {
    console.log('new tx on ' + addr)
    gangsta.show_transactions(true, [addr,])
}
gangsta.apply_editor_logic = function(txid, container, avail_bkp) {
    gangsta.transactions['tmp'] = {}
    console.log(container.find('.tx_available').text())
    $.extend(true, gangsta.transactions['tmp'], gangsta.transactions[txid])
    gangsta.transactions['tmp']['available'] = avail_bkp
    $.each(gangsta.transactions['tmp']['transaction']['data']['vins'], function() {
        this['amount'] = parseInt(parseFloat(this['amount']) * 100000000)

    })
    $.each(gangsta.transactions['tmp']['transaction']['data']['vouts'], function() {
        this['amount'] = parseInt(parseFloat(this['amount']) * 100000000)

    })
    gangsta.transactions['tmp']['transaction']['data']['fee'] = parseFloat(gangsta.transactions['tmp']['transaction']['data']['fee']) * 100000000
    container.find('.tx_fee').unbind().on('change', function() {
        var avail = gangsta.transactions['tmp']['available']
        var edit_change = function(pos, new_v) {
            gangsta.transactions['tmp']['transaction']['data']['vouts'][pos]['amount'] = parseInt(new_v)
            $.each(container.find('.changeAmount'), function() {
                if ($(this).parent().parent().children().eq(0).text() == pos) {
                    var v = new_v != 0 ? new_v.toFixed(8) : 0
                    $(this).parent().html(v / 100000000 + ' <i class="changeAmount glyphicon glyphicon-retweet"></i>')
                }
            })
        }
        var restore_changes = function(txid) {
            var txid = txid
            $.each(container.find('.changeAmount'), function() {
                var pos = $(this).parent().parent().children().eq(0).text()
                $(this).parent().html(gangsta.transactions[txid]['transaction']['data']['vouts'][pos]['amount'] + ' <i class="changeAmount glyphicon glyphicon-retweet"></i>')
            })
            $(this).parent()
        }
        var changes = []
        $.each(container.find('.changeAmount'), function() {
            changes.push([$(this).parent().parent().children().eq(0).text(), parseFloat($(this).parent().text())*100000000])
        })
        var available = parseFloat(avail)*100000000
        fee = parseFloat($(this).val())*100000000
        restore_changes(txid)
        console.log(fee)
        if (isNaN(fee) || fee < gangsta.transactions['tmp']['transaction']['data']['fee'] || fee > available) {
            $(this).parent().addClass('has-error')
            restore_changes(txid)
            container.find('.tx_available').text(gangsta.transactions['tmp']['available'])
        } else {
            $(this).parent().removeClass('has-error')
            $.each(changes, function() {
                if (fee < Number(this[1])) {
                    edit_change(Number(this[0]), Number(this[1]) - fee)
                    return false
                } else {
                    fee = fee - Number(this[1])
                    edit_change(Number(this[0]), 0)
                }
            })
            container.find('.tx_available').text((parseFloat(gangsta.transactions['tmp']['available']) - parseFloat($(this).val())).toFixed(8))
        }
    })
    container.find(".input_addr").unbind().on('change', function() {
        var input_addr = $(this).val()
        var input_id = $(this).parent().parent().children().eq(0).text()
        if (gangsta.validatePubKey(input_addr)) {
            console.log('valid')
            gangsta.transactions['tmp']['transaction']['data']['vouts'][input_id]['address'] = $(this).val()
            $(this).parent().removeClass('has-error')
        } else {
            console.log('not valid')
            $(this).parent().addClass('has-error')
        }
    })
    container.find(".buildTx_btn").unbind().on('click', function() {
        gangsta.transactions['tmp']['tx_obj'] = gangsta.create_unsigned_tx_object(gangsta.transactions['tmp']['transaction'])
        gangsta.transactions['tmp']['tx_obj'] = gangsta.sign_tx(gangsta.transactions['tmp']['tx_obj'])
        var tx = gangsta.transactions['tmp']['tx_obj']['obj'].build()
        gangsta.populate_tx_modal(tx)
    })
}
gangsta.edit_transaction = function(txid, dont_popup) {
    // true avoid the tx pop up
    if (gangsta.transactions.hasOwnProperty(txid) && gangsta.transactions[txid]['at_block'] == gangsta.data['current_block']) {
        gangsta.show_edit_transaction(txid, dont_popup)
    } else {
        gangsta.get_tx(txid, function() {
            gangsta.show_edit_transaction(txid, dont_popup)
        })
    }
}
gangsta.create_unsigned_tx_object = function(source) {
    if (!source['data'].hasOwnProperty('vouts') && !source['data'].hasOwnProperty('vins')) return false
    var txdict = {'vin_sources':[]}
    var txobj = new bitcoin.TransactionBuilder()
    $.each(source['data']['vins'], function() {
        txobj.addInput(this['vout_tx'], parseInt(this['n']))
        txdict['vin_sources'].push(this['address'])
    })
    $.each(source['data']['vouts'], function(){
        txobj.addOutput(this['address'], this['amount'])
    })
    if (source['data'].hasOwnProperty('message') && source['data']['message'].length > 0) {
        //TODO OP_RETURN
    }
    if (txobj) {
        txdict['status'] = 'success'
        txdict['obj'] = txobj
    } else {
        txdict['status'] = 'error'
    }
    return txdict
}
gangsta.sign_tx = function(txdict) {
    var txobj = txdict['obj']
    i = 0
    $.each(txdict['vin_sources'], function() {
        txobj.sign(i, gangsta.wallet[gangsta.getAddressIndex(this)]['key'])
        i += 1
    })
    txdict['obj'] = txobj
    return txdict
}
gangsta.decode_tx = function(rawtx, cb, eb) {
    console.log(rawtx)
    //todo: js decoder
    $.ajax({type: 'POST', url: 'decodeTx/', data: {"rawtx": rawtx}}).success(function(res) {
        console.log(res)
        if (res['status'] == 'success') {
            cb(res)
        } else {
            eb(res)
        }
    }).error(function(e) {
        eb(e)
    })
}
gangsta.push_tx = function(rawtx, cb, eb) {
    console.log(rawtx)
    $.ajax({type: 'POST', url: 'pushTx/', data: {"rawtx": rawtx}}).success(function(res) {
        console.log(res)
        if (res['status'] == 'success') {
            cb(res['txid'])
        } else {
            eb(res)
        }
    }).error(function(e) {
        eb(e)
    })
}

// ui stuff
gangsta.show_transactions = function(clean, addrs) {
    var addresses = []
    var clean_addr = false
    if (clean == true && !addrs) {
        var addresses = gangsta.wallet
        $(".transactions_tables").empty()
    }
    else if (!clean && !addrs) var addresses = gangsta.wallet
    else if (addrs) {
        $.each(addrs, function() {
            console.log(String(this))
            if (typeof gangsta.getAddressIndex(String(this)) == 'number') addresses.push(gangsta.wallet[gangsta.getAddressIndex(String(this))])
            // or fail with addr at index 0
            clean_addr = true
        })
    }
    $.each(addresses, function() {
        if (clean_addr) $('#transactions_addr_'+this['pub']).remove()
        if (this['transactions'].length > 0) {
            var i = 0
            var addressTable = $("#address_table_view").clone().attr('id', 'transactions_addr_'+this['pub']).removeClass('hidden')
            addressTable.find('.address').text(this['pub'])
            var tbody = addressTable.find('.transactions_tbody')
            $.each(this['transactions'], function() {
                i += 1
                var tr = $('<tr/>')
                $('<td/>').text(i).appendTo(tr)
                $('<td/>').text(new Date(this['time']*1000).toLocaleDateString() + ", " + new Date(this['time']*1000).toLocaleTimeString()).appendTo(tr)
                $('<td/>', {'class': 'txid'}).text(this['tx']).appendTo(tr)
                $('<td/>', {'width': '15%'}).text(this['amount'] > 0  ? "+" + this['amount'] : "" + this['amount']).appendTo(tr).css('color', this['amount'] > 0 ? 'darkGreen' : 'darkRed')
                $('<td/>', {'width': '10%'}).html((this['confirms'] == 0) ? (this['amount'] < 0 ? '<a href="#" class="txUnconfirmed">Unconfirmed <i class="glyphicon glyphicon-edit"></i></a>' : '<span class="receivedUnconfirmed">Unconfirmed</span>') : this['confirms'] + ' confirmations').appendTo(tr)
                tr.appendTo(tbody)
            })
            addressTable.appendTo('.transactions_tables')
            $(".txUnconfirmed").unbind().on('click', function() {
                var txid = $(this).parent().parent().children().eq(2).text()
                if (txid.length > 0) gangsta.edit_transaction(txid)
            })
        }
    })
    if ($(".transactions_tables").children().length > 0) {
        $(".transactions_tables").removeClass('hidden')
        $(".no_transactions").addClass('hidden')
    }
    var unconf = false
    $.each($(".transactions_tables").children(), function() {
        if ($(this).find('.receivedUnconfirmed').length > 0) {
            $(this).prependTo(".transactions_tables")
        }
    })
    $.each($(".transactions_tables").children(), function() {
        if ($(this).find('.txUnconfirmed').length > 0) {
            $(this).prependTo(".transactions_tables")
            var unconf = true
        }
        gangsta.show_unspent_outputs_on_wallet($(".transactions_tables").children().eq(0)[0].id.replace('transactions_addr_', ''))
    })
    $(".empty_transactions").addClass('hidden')
    $(".transactions_row").removeClass('hidden')
    if (addrs && unconf) $.playSound('/audio/beep-07', 'mp3') // 'if addrs' because doesn't happen on load
};

gangsta.show_unspent_outputs_on_wallet = function(addr) {
    var zero_confs = []
    var zero_string = ''
    $.each(gangsta.wallet[gangsta.getAddressIndex(addr)]['transactions'], function() {
        if ((this['confirms'] == 0) && (this['amount'] < 0)) zero_confs.push(this)
    })
    $("#addr_"+addr).find('.spent_unconfirmed').text('')
    if (zero_confs.length > 0) {
        var i = 1
        $.each(zero_confs, function() {
            zero_string += '<a href="#" class="spentUnconfirmed txid_'+this['tx']+'">'+this['amount']+'</a>'
            console.log(zero_confs.length)
            if (i != zero_confs.length) zero_string += ', '
            i += 1
        })
        $("#addr_"+addr).find('.spent_unconfirmed').html(zero_string)
    }
    $(".spentUnconfirmed").unbind().on('click', function() {
        $.each(this.classList, function() {
            var x = String(this)
            console.log(x)
            if (x.indexOf("_") > -1) {
                var l = x.split("_")
                if (l[0] == 'txid') {
                    gangsta.edit_transaction(l[1])
                    return false
                }
            }
        })
    })
}

gangsta.show_keys = function(append, cb) {
    if (!append == true) $(".wallet_tbody").empty()
    var i = 1
    $(".wallet_tbody").empty()
    $.each(gangsta.wallet, function() {
        var tr = $("<tr/>", {'id': 'addr_'+this['pub']})
        $("<td/>", {class: 'entry_number'}).text(i).appendTo(tr)
        $("<td/>", {class: 'pubkey'}).text(this['pub']).appendTo(tr)
        $("<td/>", {class: 'nb_txs'}).appendTo(tr)
        $("<td/>", {class: 'balance'}).appendTo(tr)
        $("<td/>", {class: 'spent_unconfirmed'}).appendTo(tr)
        tr.appendTo($(".wallet_tbody"))
        i += 1
    })
    $(".wallet_keys_imported").text(gangsta.wallet.length)
    if (cb) cb()
}
gangsta.show_wallet_details = function() {
    wallet_balance = 0
    $.each(gangsta.wallet, function() {
        $(".wallet_tbody").find("#addr_"+this['pub']).find('.balance').text(this['balance'])
        $(".wallet_tbody").find("#addr_"+this['pub']).find('.nb_txs').text(this['nb_txs'])
        wallet_balance += this['balance']
    })
    $(".wallet_balance").text(wallet_balance.toFixed(8))
    gangsta.wallet_progress_bar(50, 'fetching transactions')
}

gangsta.wallet_progress_bar = function(size, message) {
    if (parseFloat($(".progress-bar").parent().css('width')) > parseFloat($(".progress-bar").css('width') ) * 2) {
        $(".progress-bar").css('width', size+'%').text(message)
    }
}

gangsta.set_last_check = function(recursive) {
    if (gangsta.data.hasOwnProperty('last_unconfirmed_check')) {
        diff = new Date().getTime() - gangsta.data['last_unconfirmed_check']
        if (diff < 10000 && diff > 1) $(".wallet_sync_status").css('color', '').text('< 10 secs ago')
        else if (diff > 10000 && diff < 30000) $(".wallet_sync_status").css('color', '').text('< 30 secs ago')
        else if (diff > 30000 && diff < 60000) $(".wallet_sync_status").css('color', '').text('< 1 min ago')
        else if (diff > 60000 && diff < 120000) $(".wallet_sync_status").css('color', '').text('< 2 min ago')
        else if (diff > 120000) $(".wallet_sync_status").css('color', 'red').text('> 2 min ago')
    } else {
        $(".wallet_sync_status").css('color', '').text('never')
    }
    if (recursive) setTimeout(function() {gangsta.set_last_check(true)}, 1000)
}

gangsta.show_edit_transaction = function(txid, dont_popup) {
    var tx = gangsta.transactions[txid]['transaction']['data']
    var message = gangsta.transactions[txid]['transaction'].hasOwnProperty('message') ? gangsta.transactions[txid]['transaction']['message'] : null
    $(".empty_transaction_edit").addClass('hidden')
    $(".editTransaction_row").removeClass('hidden').empty()
    var container = $("#transaction_editor_view").clone().attr('id', '').removeClass('hidden').addClass('editTx_'+txid)
    container.find('.tx_id').text('#' + txid)
    container.find('.tx_fee').val(tx['fee'])
    container.find('.tx_status').text(tx['is_unconfirmed'] == true ? 'No' : 'Yes')
    var seen = new Date(tx['time_utc'])
    container.find('.tx_seen').text(seen.toLocaleDateString() + ", " + seen.toLocaleTimeString())
    var load_vouts = function() {
        var tbody = container.find('.vouts_tbody')
        tbody.empty()
        $.each(tx['vouts'], function() {
            var tr = $('<tr/>')
            $('<td/>', {'width': '5%'}).text(this['n']).appendTo(tr)
            var addr_td = $('<td/>', {'width': '35%'})
            $("<input/>", {'class': 'input_addr form-control input-xlarge', 'type': 'text', 'value': this['address']}).appendTo(addr_td)
            addr_td.appendTo(tr)
            $('<td/>').text(this['type']).appendTo(tr)
            if (gangsta.getAddressIndex(this['address'])) {
                $('<td/>', {'width': '10%'}).html(this['amount'] + ' <i class="changeAmount glyphicon glyphicon-retweet"></i>').appendTo(tr)
                change_amount += parseFloat(this['amount'])
            } else {
                vouts_amount += parseFloat(this['amount'])
                $('<td/>', {'width': '10%'}).text(this['amount']).appendTo(tr)
            }
            tr.appendTo(tbody)
        })
    }
    var avail_bkp = NaN
    var load_vins = function() {
        var tbody = container.find('.vins_tbody')
        tbody.empty()
        $.each(tx['vins'], function() {
            var tr = $('<tr/>')
            $('<td/>').text(this['n']).appendTo(tr)
            $('<td/>').text(this['type']).appendTo(tr)
            $('<td/>').text(this['address']).appendTo(tr)
            $('<td/>').text(this['vout_tx']).appendTo(tr)
            $('<td/>').text(this['amount']).appendTo(tr)
            vins_amount += parseFloat(this['amount'])
            tr.appendTo(tbody)
        })
        console.log(container.find('.tx_fee').val())
    }
    var vouts_amount = 0
    var change_amount = 0
    var vins_amount = 0
    load_vouts()
    load_vins()
    avail_bkp = (-vins_amount - vouts_amount - parseFloat(container.find('.tx_fee').val())).toFixed(8)
    container.find('.tx_available').text(avail_bkp)
    container.find('.tx_amount').text(String((vouts_amount + change_amount).toFixed(8)))
    gangsta.apply_editor_logic(txid, container, avail_bkp)
    container.appendTo('.editTransaction_row')
    if (!dont_popup) $(".editTransactionTab_btn").click()
}

gangsta.update_show_edit_transaction = function(txid) {
    tx = gangsta.transactions[txid]['transaction']['data']
    var container = $(".editTransaction_row")
    var tx_id = container.find('.tx_id').text().replace(/#/g, "")
    if (txid != tx_id) return false
    container.find('.tx_status').html(tx['is_unconfirmed'] == true ? 'No' : '<span style="color: darkRed">Yes</span>')
    var seen = new Date(tx['time_utc'])
    container.find('.tx_seen').text(seen.toLocaleDateString() + ", " + seen.toLocaleTimeString())
    if (!tx['is_unconfirmed']) container.find('.buildTx_btn').attr('disabled', true)
}

gangsta.populate_tx_modal = function(tx) {
    decode_cb = function(res) {
        var m = $("#txModal")
        var decoded = JSON.stringify(res['json'], undefined, 2)
        m.find('.tx_JSON').val(decoded)
        m.find('.pushTx').attr('disabled', false)
        gangsta.data['backend_available'] = true
    }
    decode_eb = function(e) {
        $("#txModal").find('.tx_JSON').attr('disabled', true).attr('placeholder', 'unable to contact decode/push API, use sendrawtransaction on a bitcoind patched node, instead, check FAQ')
        gangsta.handleErrors(e)
    }
    push_cb = function(txid) {
        gangsta.transactions['tmp']['pushed'] = true
        var m = $("#txModal")
        m.find('.txHash').addClass('hidden')
        m.find('.txResponse').removeClass('hidden')
        m.find('.panel').removeClass('panel-danger')
        m.find('.panel').addClass('panel-success')
        m.find('.pos_response').removeClass('hidden')
        m.find('.neg_response').addClass('hidden')
        m.find('.pos_response_tx1').find('span').text(gangsta.transactions['tmp']['transaction']['data']['tx'])
        m.find('.pos_response_tx1').find('a').attr('href', 'http://blockchain.info/tx/'+gangsta.transactions['tmp']['transaction']['data']['tx'])
        m.find('.pos_response_tx2').find('span').text(txid)
        m.find('.pos_response_tx2').find('a').attr('href', 'http://blockchain.info/tx/'+txid)
        m.find(".pushTx").attr('disabled', true)
    }
    push_eb = function(e) {
        gangsta.transactions['tmp']['pushed'] = false
        var m = $("#txModal")
        m.find('.txHash').addClass('hidden')
        m.find('.txResponse').removeClass('hidden')
        m.find('.panel').removeClass('panel-success')
        m.find('.panel').addClass('panel-danger')
        m.find('.pos_response').addClass('hidden')
        m.find('.neg_response').removeClass('hidden')
        m.find('.neg_response_tx').find('span').text($(".tx_hash").val())
        gangsta.handleErrors(e)
    }
    var m = $("#txModal")
    m.find(".tx_raw_hex").val(tx.toHex())
    m.find(".tx_hash").val(tx.getId())
    if (!gangsta.transactions['tmp'].hasOwnProperty('pushed')) {
        m.find('.txHash').removeClass('hidden')
        m.find('.txResponse').addClass('hidden')
        m.find('.pos_response').addClass('hidden')
        m.find('.neg_response').addClass('hidden')
        m.find('.pos_response_tx1').find('span').text('')
        m.find('.pos_response_tx1').find('a').attr('href', '#')
        m.find('.pos_response_tx2').find('span').text('')
        m.find('.pos_response_tx2').find('a').attr('href', '#')
        gangsta.decode_tx(tx.toHex(), decode_cb, decode_eb)
        m.find(".pushTx").unbind().on('click', function() {
            if (!gangsta.data['backend_available']) return false
            gangsta.push_tx(tx.toHex(), push_cb, push_eb)
        })
    }
}

$(".openTx").on('click', function() {
    $('.editTransactionTab_btn').click()
})
$(".empty_claim").on('click', function() {
    $(".overviewTab_btn").click()
})
$("#import_keys_btn").on('click', function() {
    gangsta.populate_wallet(function() {
        gangsta.show_keys()
        $(".empty_wallet").addClass('hidden')
        $(".wallet_row").removeClass('hidden')
        $("#cancel_import_btn").click()
        $('.walletTab_btn').click()
        gangsta.get_wallet_details(function() {
            gangsta.show_wallet_details()
            gangsta.get_transactions(false, function() {
                gangsta.show_transactions(true)
                gangsta.wallet_progress_bar(100, 'synchronized')
                setTimeout(function() {
                    gangsta.check_unconfirmed_on_addresses()
                    gangsta.set_last_check(true)
                }, 5000)
            })
        })
        gangsta.get_current_block()
    })
})
$(".force_check").on( "click", function( e ) {
    if (gangsta.data.hasOwnProperty('last_unconfirmed_check') && (new Date().getTime() - gangsta.data['last_unconfirmed_check'] < 10000)) {
        if (gangsta.data['flood_alerted'] < 2) {
            alert("Advice: avoid flooding the API or you will be banned. \n\nYou should't check status if txs are not expected. Anyway, is self-updated every 2 minutes or every block.")
        }
        gangsta.data['flood_alerted'] += 1
    }
    gangsta.check_unconfirmed_on_addresses(true)
    gangsta.set_last_check(true)
});



gangsta.handleErrors = function(e) {
    console.log(e)
    if (gangsta.debug) gangsta.errors.push(e) // debug
    // todo
}
gangsta.init()
