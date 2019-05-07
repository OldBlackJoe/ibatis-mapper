var ibatisMapper = require('../index');
ibatisMapper.createMapper([ './test/test.xml' ]);

describe("Unit Tests for iBatis-mapper", function(){
  it("1) #{...} parameters", function(done){
    var param = {
      category : 'apple'
    }
    
    var query = ibatisMapper.getStatement('fruit', 'testStringParameter', param);
    console.log(query);
    
    done();
  });
});
