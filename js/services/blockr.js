// gangsta - github.com/gdassori/gangsta
// blockr service file
// module is just made with http calls, cause in app.js resource logic is blockr.io compliant
// when other services are implemented, fetched resource needs to be adjusted to be compliant as well.

wallet_service = new Object();
wallet_service.base_url = 'http://btc.blockr.io/api/v1/'; // change to tbtc for testnet

wallet_service.get_wallet_details = function(addrs) {
    var deferred = $.Deferred();
    $.ajax(wallet_service.base_url + 'address/info/' + addrs + '?confirmations=0').success(function(res) {
        deferred.resolve(res)
    }).error(function(e) {
        deferred.reject(e)
    });
    return deferred;
};

wallet_service.get_current_block = function() {
    var deferred = $.Deferred();
    $.ajax(wallet_service.base_url + 'block/info/last').success(function(res) {
        deferred.resolve(res)
    }).error(function(e) {
        deferred.reject(e)
    });
    return deferred;
};

wallet_service.get_txs = function(addrs) {
    var deferred = $.Deferred();
    $.ajax(wallet_service.base_url + 'address/txs/' + String(addrs)).success(function(res) {
        deferred.resolve(res)
    }).error(function(e) {
        deferred.reject(e)
    });
    return deferred;
};

wallet_service.get_unconfirmed_txs = function(addrs) {
    var deferred = $.Deferred();
    $.ajax(wallet_service.base_url + 'address/unconfirmed/' + String(addrs)).success(function(res) {
        deferred.resolve(res)
    }).error(function(e) {
        deferred.reject(e)
    });
    return deferred;
};

wallet_service.get_tx = function(txid) {
    var deferred = $.Deferred();
    $.ajax(wallet_service.base_url + 'tx/info/' + txid).success(function(res) {
        deferred.resolve(res)
    }).error(function(e) {
        deferred.reject(e)
    });
    return deferred
};
