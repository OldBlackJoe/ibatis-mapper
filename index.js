var fs = require('fs');
var HTML = require('html-parse-stringify2');
var sqlFormatter = require("sql-formatter");
var convert = require('./lib/convert');
var iBatisMapper = {};

function ibatisMapper() {

}

ibatisMapper.prototype.createMapper = function(xmls) {
  const queryTypes = [ 'statement', 'select', 'insert', 'update', 'delete' ];

  // Parse each XML files
  for (var i = 0, xml; xml = xmls[i]; i++) {
    try{
      var rawText = replaceCdata(fs.readFileSync(xml).toString());     
      var mappers = HTML.parse(rawText);
    } catch (err){
			throw new Error("Error occured during open XML file [" + xml + "]");
    }
    
    try{
      for (var j = 0, mapper; mapper = mappers[j]; j++) {
        // Mapping <mapper> tag recursively
        findMapper(mapper);
      }
    } catch (err) {
      throw new Error("Error occured during parse XML file [" + xml + "]");
    }
  }
};

findMapper = function(children) {
  var queryTypes = [ 'statement', 'select', 'insert', 'update', 'delete' ];

  if (children.type == 'tag' && children.name == 'sqlMap') {
    // Add Mapper
    iBatisMapper[children.attrs.namespace] = {};

    for (var j = 0, sql; sql = children.children[j]; j++) {
      if (sql['type'] == 'tag' && queryTypes.indexOf(sql['name']) > -1) {
        iBatisMapper[children.attrs.namespace][sql.attrs.id] = sql.children;
      }
    }
    return;
  } else {
    // Recursive to next children
    if (children['children'] != null && children['children'].length > 0) {
      for (var j = 0, nextChildren; nextChildren = children.children[j]; j++) {
        findMapper(nextChildren);
      }
    } else {
      return;
    }
  }
}

replaceCdata = function(rawText) {
  var cdataRegex = new RegExp('(<!\\[CDATA\\[)([\\s\\S]*?)(\\]\\]>)', 'g');
  var matches = rawText.match(cdataRegex);
  
  if (matches != null && matches.length > 0) {
    for (var z = 0; z < matches.length; z++) {
      var regex = new RegExp('(<!\\[CDATA\\[)([\\s\\S]*?)(\\]\\]>)', 'g');
      var m = regex.exec(matches[z]);

      var cdataText = m[2];
      cdataText = cdataText.replace(/\&/g,'&amp;');
      cdataText = cdataText.replace(/\</g,'&lt;');
      cdataText = cdataText.replace(/\>/g,'&gt;');
      cdataText = cdataText.replace(/\"/g,'&quot;');
      
      rawText = rawText.replace(m[0], cdataText);
    }
  }
  
  return rawText;
}

ibatisMapper.prototype.getStatement = function(namespace, sql, param, format) {
  var statement = '';
  
  // Parameter Check
  if (namespace == null) throw new Error('Namespace should not be null.');
  if (iBatisMapper[namespace] == undefined) throw new Error('Namespace [' + namespace + '] not exists.');
  if (sql == null) throw new Error('SQL ID should not be null.');
  if (iBatisMapper[namespace][sql] == undefined) throw new Error('SQL ID [' + sql + '] not exists');
  
  try{
    for (var i = 0, children; children = iBatisMapper[namespace][sql][i]; i++) {
      // Convert SQL statement recursively
      statement += convert.convertChildren(children, param, namespace, iBatisMapper, false);
    }
    
    // Check not converted Parameters
    var regexList = ['\\#{\\S*}', '\\${\\S*}'];
    for (var i = 0, regexString; regexString = regexList[i]; i++){
      var regex = new RegExp(regex, 'g');
      var checkParam = statement.match(regexString);
      
      if (checkParam != null && checkParam.length > 0) {
        throw new Error("Parameter " + checkParam.join(",") + " is not converted.");
      }
    }

    // SQL formatting
    if (format != undefined && format != null){
      statement = sqlFormatter.format(statement, format);
    }
  } catch (err) {
    throw err
  }
  
  return statement;
};

ibatisMapper.prototype.getMapper = function() {
  return iBatisMapper;
};

module.exports = new ibatisMapper();