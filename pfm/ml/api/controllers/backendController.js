var request = require('request');
const tf = require('@tensorflow/tfjs');
var mongoose = require('mongoose'),
  config = require('../../config'),
  Registros = mongoose.model('Registros');

  exports.deleteAllNoticias = function(req, res) {
    Registros.deleteMany({}, function(err, task) {
      if (err)
        res.send(err);
      res.json({ message: 'All registros successfully deleted' });
    });
  };

  exports.list_all = function(req, res) {
    Registros.find({}, function(err, task) {
      if (err)
        res.send(err);
      res.json(task);
    });
  };
exports.entrena = async function(req, res) {
    var data = getData();
    const model = tf.sequential(); 
    
    // Add a single input layer
    model.add(tf.layers.dense({inputShape: [1], units: 1, useBias: true}));
    model.add(tf.layers.dense({units: 50, activation: 'sigmoid'}));
    
    // Add an output layer
    model.add(tf.layers.dense({units: 1, useBias: true}));
    const tensorData = convertToTensor(data);
    const {inputs, labels} = tensorData;
    console.log("Comenzamos a entrenar el modelo");
    await trainModel(model, inputs, labels);
    console.log("Entrenamiento realizado");
    testModel(model, data, tensorData);  
    almacenaVariables(model, tensorData,res);  
  };

  exports.estimacion = function(req, res) {
     var value = req.body.value;
     Registros.find({}, function(err,registro){
      var pendiente = registro[0].pendiente;
      var nplus = registro[0].nplus;
      valor_estimado = (pendiente*value)+nplus;
      console.log("Entra en estimacion")
      console.log(pendiente);
      console.log(nplus);
      console.log(value);
      console.log(valor_estimado);
      res.json(valor_estimado);
    }).sort({_id: -1}).limit(1);
  };

function getData() {
  const fs = require('fs');
  let global_data = fs.readFileSync("cotizaciones.json");
  let data_semi = JSON.parse(global_data);
  const cleaned = data_semi.map(value => ({
    open: value.Open,
    close: value.Close,
  }));  
  return cleaned;
}

function convertToTensor(data) {
  // Wrapping these calculations in a tidy will dispose any 
  // intermediate tensors.
  
  return tf.tidy(() => {
    // Step 1. Shuffle the data    
    tf.util.shuffle(data);

    // Step 2. Convert data to Tensor
    const inputs = data.map(d => d.open)
    const labels = data.map(d => d.close);

    const inputTensor = tf.tensor2d(inputs, [inputs.length, 1]);
    const labelTensor = tf.tensor2d(labels, [labels.length, 1]);

    //Step 3. Normalize the data to the range 0 - 1 using min-max scaling
    const inputMax = inputTensor.max();
    const inputMin = inputTensor.min();  
    const labelMax = labelTensor.max();
    const labelMin = labelTensor.min();

    const normalizedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin));
    const normalizedLabels = labelTensor.sub(labelMin).div(labelMax.sub(labelMin));

    return {
      inputs: normalizedInputs,
      labels: normalizedLabels,
      // Return the min/max bounds so we can use them later.
      inputMax,
      inputMin,
      labelMax,
      labelMin,
    }
  });  
}

async function trainModel(model, inputs, labels) {
  // Prepare the model for training.  
  model.compile({
    optimizer: tf.train.adam(),
    loss: tf.losses.meanSquaredError,
    metrics: ['mse'],
  });
  
  const batchSize = 40;
  const epochs = 80;
  return await model.fit(inputs, labels, {
    batchSize,
    epochs,
    shuffle: true,
  });
}

function testModel(model, inputData, normalizationData) {
  const {inputMax, inputMin, labelMin, labelMax} = normalizationData;  
  
  // Generate predictions for a uniform range of numbers between 0 and 1;
  // We un-normalize the data by doing the inverse of the min-max scaling 
  // that we did earlier.
  const [xs, preds] = tf.tidy(() => {
    
    const xs = tf.linspace(0, 1, 100);    
    const preds = model.predict(xs.reshape([100, 1]));      
    
    const unNormXs = xs
      .mul(inputMax.sub(inputMin))
      .add(inputMin);
      
    const unNormPreds = preds
      .mul(labelMax.sub(labelMin))
      .add(labelMin);
    
    // Un-normalize the data
    return [unNormXs.dataSync(), unNormPreds.dataSync()];
  });
  
 
  const predictedPoints = Array.from(xs).map((val, i) => {
    return {x: val, y: preds[i]}
  });
  
  const originalPoints = inputData.map(d => ({
    x: d.open, y: d.close,
  }));
  // habría que enviar a cliente para que lo pinten -> originalPoints, predictedPoints
}

function almacenaVariables(model, normalizationData,res) {
  const {inputMax, inputMin, labelMin, labelMax} = normalizationData;  
  
  const [xs, preds] = tf.tidy(() => {
    
    const xs = tf.linspace(0, 1, 100);    
    const preds = model.predict(xs.reshape([100, 1]));      
    
    const unNormXs = xs
      .mul(inputMax.sub(inputMin))
      .add(inputMin);
      
    const unNormPreds = preds
      .mul(labelMax.sub(labelMin))
      .add(labelMin);
    
    const pend = inputMax.sub(inputMin).div(labelMax.sub(labelMin));
    const nplus = labelMax.sub(inputMax.sub(pend));
    console.log("Pendiente y nplus");
    var pendiente_recta = pend.toString();
    var nplus_valor = nplus.toString();
    console.log(pendiente_recta);
    console.log(nplus_valor);
    var data =[];
    data["pendiente"]=parseFloat(limpiarString(pendiente_recta));
    data["nplus"]=parseFloat(limpiarString(nplus_valor));
    data["timestamp"] = new Date();
    console.log(data);
    var new_task = new Registros(data);
    new_task.save(function(err, news) {
      if (err)
        console.log("Error actualizando entrenamientos");
      console.log(news);
    });
    return [pendiente_recta,nplus_valor]
  });


}

function limpiarString(value){
  const regex = /\d+.\d+/g;
      let m;
      let string_publicar;
      while ((m = regex.exec(value)) !== null) {
          // This is necessary to avoid infinite loops with zero-width matches
          if (m.index === regex.lastIndex) {
              regex.lastIndex++;
          }
          // The result can be accessed through the `m`-variable.
          m.forEach((match, groupIndex) => {
              console.log(`Found match, group ${groupIndex}: ${match}`);
              string_publicar= match;
          });
      }
  return string_publicar;

}