'use strict';
const _ = require('lodash')
var mongoose = require('mongoose'),
  jwt = require('jsonwebtoken'),
  config = require('../../config'),
  Registros = mongoose.model('Registros');

exports.list_all_registros = function(req, res) {
  Registros.find({}, function(err, task) {
    if (err)
      res.send(err);
    res.json(task);
  });
};


exports.updateDb = function(req, res) {
  var request = require('request');
  var options = {
    'method': 'GET',
    'url': 'http://api.coinlayer.com/live?access_key=00157dd1a2a6c6267a87c5aedcfecdba&target=EUR',
    'headers': {
    }
  };
  
  var data = request(options, function (error, response) { 
    if (error) throw new Error(error);
    var data= JSON.parse(response.body);
    var date = new Date(data.timestamp * 1000);
    data.timestamp = date;
    delete data['success'];
    delete data['terms'];
    delete data['privacy'];
    console.log(data);
    var new_task = new Registros(data);
    new_task.save(function(err, task) {
      if (err)
        res.send(err);
      res.json(task);
    });
  });
  
};

exports.updateDbCron = function() {
  var request = require('request');
  var options = {
    'method': 'GET',
    'url': 'http://api.coinlayer.com/live?access_key=00157dd1a2a6c6267a87c5aedcfecdba&target=EUR',
    'headers': {
    }
  };
  
  var data = request(options, function (error, response) { 
    if (error) throw new Error(error);
    var data= JSON.parse(response.body);
    var date = new Date(data.timestamp * 1000);
    data.timestamp = date;
    delete data['success'];
    delete data['terms'];
    delete data['privacy'];
    console.log(data);
    var new_task = new Registros(data);
    new_task.save(function(err, task) {
      if (err)
        console.log("Error updating db");
      console.log(task);
    });
  });
  
};

exports.add_registro = function(req, res) {
  var data = req.body;
  var date = new Date(data.timestamp * 1000);
  data.timestamp = date;
  var rates = data.rates;
  var mydatas= JSON.parse(rates);
  data.rates=mydatas;
  console.log(data);

  var new_task = new Registros(data);
  new_task.save(function(err, task) {
    if (err)
      res.send(err);
    res.json(task);
  });
};


exports.update_registro = function(req, res) {
  //
};

exports.buscarPorFecha = function(req, res) {
  var fecha_desde = req.params.fecha_inicio;
  var fecha_hasta = req.params.fecha_fin;
  Registros.find({timestamp:{
    $gte: fecha_desde,
    $lte: fecha_hasta
  }}, function(err, task) {
    if (err)
      res.send(err);
    res.json(task);
  });
};
exports.buscarPorFechaFiltrando = function(req, res) {
  var fecha_desde = req.body.fecha_inicio;
  var fecha_hasta = req.body.fecha_fin;
  var rates = req.body.currencies;
  Registros.find({timestamp:{
    $gte: fecha_desde,
    $lte: fecha_hasta
  }}, function(err, tasks) {
    var data = JSON.stringify(tasks);
    var data_json = JSON.parse(data);
    var keys = Object.keys(data_json);
    var result=[];
    for(var i=0;i<=keys.length-1;i++){
      var sub_json = data_json[i];
      var hijo={};
      hijo._id=sub_json._id;
      hijo.timestamp=sub_json.timestamp;
      hijo.currency=sub_json.currency;
      var keys_rates = Object.keys(sub_json.rates);
      var array_input_rates = rates.split(',');
      hijo.rates=[];
      for(var j=0;j<=keys_rates.length-1;j++){
        for(var k=0; k<=array_input_rates.length-1;k++){
            if(keys_rates[j].localeCompare(array_input_rates[k])==0){
              var value_rate=sub_json.rates[keys_rates[j]];
              var name_rate = keys_rates[j];
              var sub_rate={};
              sub_rate[name_rate]=value_rate;
              hijo.rates.push(sub_rate);
            }
        }
      }
      console.log(hijo);
      result.push(hijo);
    }
    res.json(result);
  });
};

exports.convertirMonedas = function(req, res) {
  var divisaOrigen = req.params.divisaOrigen;
  var divisaDestino = req.params.divisaDestino;
  var cantidad = req.params.cantidad;

  Registros.findOne({}, {}, { sort: { 'created_at' : -1 } }, function(err, task) {
    console.log(task);
    var keys = Object.keys(task.rates);
    let cot_divisa_destino=0;
    let cot_divisa_origen=0;
    //Get the currency of last inputs of rates
    keys.forEach(element => {
      if(element == divisaDestino){
          cot_divisa_destino = task.rates[divisaDestino];
        }
    }); 
    keys.forEach(element => {
      if(element == divisaOrigen){
        cot_divisa_origen = task.rates[divisaOrigen];
        }
    }); 
      //maths 
    var total_origen = cantidad * cot_divisa_origen;
    var total_destino = total_origen/cot_divisa_destino;
    var data = {};
    data.divisaOrigen=divisaOrigen;
    data.divisaDestino=divisaDestino;
    data.cantidad = cantidad;
    data.conversion= total_destino;
    res.json(data);
    });
};

exports.convertirEuros = function(req, res) {
  var divisaOrigen = req.params.divisaOrigen;
  var cantidad = req.params.cantidad;

  Registros.findOne({}, {}, { sort: { 'created_at' : -1 } }, function(err, task) {
    console.log(task);
    var keys = Object.keys(task.rates);
    let cot_divisa_destino=0;
    let cot_divisa_origen=0;
    keys.forEach(element => {
      if(element == divisaOrigen){
        cot_divisa_origen = task.rates[divisaOrigen];
        }
    }); 
      //maths 
    var total_origen = cantidad * cot_divisa_origen;
    var data = {};
    data.divisaOrigen=divisaOrigen;
    data.divisaDestino="EUR";
    data.cantidad = cantidad;
    data.conversion= total_origen;
    res.json(data);
    });
};


exports.deleteregistro = function(req, res) {
  Registros.deleteOne({
    _id: req.params.registroId
  }, function(err, task) {
    if (err)
      res.send(err);
    res.json({ message: 'Register successfully deleted'});
  });
};

exports.deleteAll = function(req, res) {
  Registros.deleteMany({}, function(err, task) {
    if (err)
      res.send(err);
    res.json({ message: 'All registers successfully deleted' });
  });
};