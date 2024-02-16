var convertChildren = function(children, param, namespace, iBatisMapper, isFirst) {
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
    case 'isEqual':
    case 'isNotEqual':
    case 'isGreaterThan':
    case 'isGreaterEqual':
    case 'isLessThan':
    case 'isLessEqual':
      return convertBinaryCondition(children, param, namespace, iBatisMapper, isFirst);
    case 'isPropertyAvailable':
    case 'isNotPropertyAvailable':
    case 'isNull':
    case 'isNotNull':
    case 'isEmpty':
    case 'isNotEmpty':
	  return convertBinaryCondition(children, param, namespace, iBatisMapper, isFirst, true);
    case 'iterate':
      return convertIterate(children, param, namespace, iBatisMapper);
    default:
      throw new Error("Unknown tag name - " + children.name);
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
        var reg = new RegExp('\\#' + (keyString + key) + '(:[^#]+)?\\#', 'g');
        
        var tempParamKey = ('NULL')
        convertString = convertString.replace(reg, tempParamKey);
      } else {
        var reg = new RegExp('\\#' + (keyString + key) + '(:[^#]+)?\\#', 'g');

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
  var childString = '';
  
  var isFirst = true;
  for (var i=0, nextChildren; nextChildren=children['children'][i]; i++){
    childString = convertChildren(nextChildren, param, namespace, iBatisMapper, isFirst);
    convertString += childString;
    
    if (isFirst) {
      var emptyRegex = new RegExp('([^\\s])', 'g');
      var w = childString.match(emptyRegex);
      
      if (w != null && w.length > 0) {
        isFirst = false;
      }
    }
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
    throw new Error("Error occurred during convert <" + children.name.toLowerCase() + "> element.");
  }
}

var convertBinaryCondition = function(children, param, namespace, iBatisMapper, isFirst, isUnary) {
  try{
    var property = children.attrs.property;
    var removeFirstPrepend = ('removeFirstPrepend' in children.attrs) ? children.attrs.removeFirstPrepend : false;
    var compareValue = null;
    var evalResult = false;
    
    if ('compareProperty' in children.attrs) {
      compareValue = param[children.attrs.compareProperty];
    } else if ('compareValue' in children.attrs) {
      compareValue = children.attrs.compareValue;
    } else if (isUnary != true) {
      throw new Error("Error occurred during convert <" + children.name.toLowerCase() + "> element.");
    }
    
    switch (children.name) {
      case 'isEqual':
        evalResult = (param[property] == compareValue);
        break;
      case 'isNotEqual':
        evalResult = (param[property] != compareValue);
        break;
      case 'isGreaterThan':
        evalResult = (Number(param[property]) > Number(compareValue));
        break;
      case 'isGreaterEqual':
        evalResult = (Number(param[property]) >= Number(compareValue));
        break;
      case 'isLessThan':
        evalResult = (Number(param[property]) < Number(compareValue));
        break;
      case 'isLessEqual':
        evalResult = (Number(param[property]) <= Number(compareValue));
        break;
      case 'isPropertyAvailable': //undefined is not a standard value in JSON
        evalResult = param[property] !== undefined;
        break;
	  case 'isNotPropertyAvailable':
        evalResult = param[property] === undefined;
        break;
	  case 'isNull': //undefined == null is true
        evalResult = param[property] == null;
        break;
	  case 'isNotNull':
        evalResult = param[property] != null;
        break;
	  case 'isEmpty':
	    if (param[property] != null && typeof value !== 'string' && typeof value !== 'object') {
			throw new Error("isEmpty / isNotEmpty is ONLY for String / Collection! Current value of " + property + " is " + param[property]);
		}
        evalResult = !(param[property] != null && Object.keys(param[property]).length > 0);
        break;
	  case 'isNotEmpty':
		if (param[property] != null && typeof value !== 'string' && typeof value !== 'object') {
			throw new Error("isEmpty / isNotEmpty is ONLY for String / Collection! Current value of " + property + " is " + param[property]);
		}
        evalResult = param[property] != null && Object.keys(param[property]).length > 0;
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
      
      // (a) when the tag’s resulting body content is empty.
      var emptyRegex = new RegExp('([^\\s])', 'g');
      var w = convertString.match(emptyRegex);
      
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
          // (b) if the tag is the first to produce body content and is nested in a tag with the removeFirstPrepend attribute set to true.
          // (c) if the tag is the first to produce body content following a <dynamic> tag with a prepend attribute value that is not empty.
          if (removeFirstPrepend == false || isFirst == false){
            convertString = children.attrs.prepend + ' '+ convertString;
          }
        }
      }
      
      return convertString;
    } else {
      return '';
    }
  } catch (err) {
	console.log(err);
    throw new Error("Error occurred during convert <" + children.name.toLowerCase() + "> element.");
  }
}

var convertIterate = function(children, param, namespace, iBatisMapper) {
  try {
    const {property, open, close, conjunction} = children.attrs;

    if (!param.hasOwnProperty(property))
    {
      console.log('There is no propery in param for iterate');
      return;
    }

    var convertString = param[property].reduce((prev, cur, index)=>{
        var iterateValue = (index === 0) ? `${open}'${cur}'` : `${prev}${conjunction}'${cur}'`;
        if (index === param[property].length - 1)
          iterateValue += close;
        return 	iterateValue
      }, `${open}${close}`);

    return convertString;
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