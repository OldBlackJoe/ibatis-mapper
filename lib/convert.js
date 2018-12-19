var convertChildren = function(children, param, namespace, iBatisMapper) {
  if (param == null) {
    param = {};
  }
  if (!isDict(param)){
    throw new Error("Parameter argument should be Key-Value type or Null.");
  }
  
  if (children.type == 'text') {
    // Convert Parameters
    return convertParameters(children, param);

  } else if (children.type == 'tag') {
    switch (children.name) {
    case 'dynamic':
      return convertDynamic(children, param, namespace, iBatisMapper);
      break;
    case 'isEqual':
    case 'isNotEqual':
    case 'isGreaterThan':
    case 'isGreaterEqual':
    case 'isLessThan':
    case 'isLessEqual':
      return convertBinaryCondition(children, param, namespace, iBatisMapper);
      break;
    default:
      console.log(children);
      throw new Error("XML is not well-formed character or markup. Consider using CDATA section.");
      break;
    }
  } else {
    return '';
  }
}

var convertParameters = function(children, param) {
  var convertString = children.content;

  try{
    var keyString = '';  
    if (param !== null && Object.keys(param).length != 0) {
      convertString = recursiveParameters(convertString, param, keyString);
    }
  } catch (err) {
    throw new Error("Error occurred during convert parameters.");
  }
  
  try{
    // convert CDATA string
    convertString = convertString.replace(/(\&amp\;)/g,'&');
    convertString = convertString.replace(/(\&lt\;)/g,'<');
    convertString = convertString.replace(/(\&gt\;)/g,'>');
    convertString = convertString.replace(/(\&quot\;)/g,'"');
  } catch (err) {
    throw new Error("Error occurred during convert CDATA section.");
  }
  
  return convertString;
}

var recursiveParameters = function(convertString, param, keyString) {
  var keyDict = Object.keys(param);  
  
  for (var i=0, key; key=keyDict[i]; i++) {
    if (isDict(param[key])){
      var nextKeyString = keyString + key + '\\.';
      convertString = recursiveParameters(convertString, param[key], nextKeyString);
    } else {
      if (param[key] == null || param[key] == undefined) {
        var reg = new RegExp('\\#' + (keyString + key) + '\\#', 'g');
        
        var tempParamKey = ('NULL')
        convertString = convertString.replace(reg, tempParamKey);
      } else {
        var reg = new RegExp('\\#' + (keyString + key) + '\\#', 'g');

        var tempParamKey = (param[key] + '').replace(/"/g, '\\\"');
        tempParamKey = tempParamKey.replace(/'/g, '\\\'');        
        convertString = convertString.replace(reg, "'" + tempParamKey + "'");
      }

      var reg = new RegExp('\\${' + (keyString + key) + '\\$', 'g');
      var tempParamKey = (param[key] + '')
      convertString = convertString.replace(reg, tempParamKey);
    }
  }
  
  return convertString;
}

var convertDynamic = function(children, param, namespace, iBatisMapper) {
  var convertString = '';

  for (var i=0, nextChildren; nextChildren=children['children'][i]; i++){
    convertString += convertChildren(nextChildren, param, namespace, iBatisMapper);
  }
  
  try{
    // Check string is empty
    var dynamicRegex = new RegExp('([^\\s])', 'g');
    var w = convertString.match(dynamicRegex);
    
    if (w != null && w.length > 0) {
      // Add close if string is not empty
      if ('close' in children.attrs && children.attrs.close.length > 0) {
        convertString = convertString + children.attrs.close ;
      }
      
      // Add open if string is not empty
      if ('open' in children.attrs && children.attrs.open.length > 0) {
        convertString = children.attrs.open + convertString;
      }
      
      // Add prepend if string is not empty
      if ('prepend' in children.attrs && children.attrs.prepend.length > 0) {
        convertString = children.attrs.prepend + ' '+ convertString;
      }
    }

    return convertString;
  } catch (err) {
    console.log(err);
    throw new Error("Error occurred during convert <" + children.name.toLowerCase() + "> element.");
  }
}

var convertBinaryCondition = function(children, param, namespace, iBatisMapper) {
  try{
    var property = children.attrs.property;
    var compareValue = null;
    var evalResult = false;
    
    if ('compareProperty' in children.attrs) {
      compareValue = param[children.attrs.compareProperty];
    } else if ('compareValue' in children.attrs) {
      compareValue = children.attrs.compareValue;
    } else {
      throw new Error("Error occurred during convert <" + children.name.toLowerCase() + "> element.");
    }
    
    switch (children.name) {
    case 'isEqual':
      evalResult = (property === compareValue);
      break;
    case 'isNotEqual':
      evalResult = (property !== compareValue);
      break;
    case 'isGreaterThan':
      evalResult = (property > compareValue);
      break;
    case 'isGreaterEqual':
      evalResult = (property >= compareValue);
      break;
    case 'isLessThan':
      evalResult = (property < compareValue);
      break;
    case 'isLessEqual':
      evalResult = (property <= compareValue);
      break;
    default:
      throw new Error("Error occurred during convert <" + children.name.toLowerCase() + "> element.");
      break;
    }
    
    if (evalResult){
      var convertString = '';
      for (var i=0, nextChildren; nextChildren=children['children'][i]; i++){
        convertString += convertChildren(nextChildren, param, namespace, iBatisMapper);
      }
      return convertString;
    } else {
      return '';
    }
  } catch (err) {
    throw new Error("Error occurred during convert <" + children.name.toLowerCase() + "> element.");
  }
}

var isDict = function(v) {
  return typeof v==='object' && v!==null && !(v instanceof Array) && !(v instanceof Date);
}

var replaceEvalString = function(evalString, param) {
  var keys = Object.keys(param);

  for (var i=0; i<keys.length; i++){
    var replacePrefix = '';
    var replacePostfix = '';
    var paramRegex = null;
    
    if (isDict(param[keys[i]])) {
      replacePrefix = ' param.';
      replacePostfix = '';
      
      paramRegex = new RegExp('(^|[^a-zA-Z0-9])(' + keys[i] + '\\.)([a-zA-Z0-9]+)', 'g');
    } else {      
      replacePrefix = ' param.';
      replacePostfix = ' ';
      
      paramRegex = new RegExp('(^|[^a-zA-Z0-9])(' + keys[i] + ')($|[^a-zA-Z0-9])', 'g');
    }
  
    evalString = evalString.replace(paramRegex, ("$1" + replacePrefix + "$2" + replacePostfix + "$3"));
  }
  
  return evalString;
}

module.exports = {
  convertChildren,
  convertParameters
};