
var DATANUMTYPES = makeEnum('integer','float','triple','minimtx','string','parent');
var DATACOUNT = makeEnum('single','array');

var packBinary;
var unpackBinary;

function SETUP_io(){
	
	
	
	
	
	function concatArraybuffers(list){
		var fullSize = 0;
		for(var i=0; i<list.length; i++) fullSize += list[i].byteLength;
		var intoBuffer = new ArrayBuffer(fullSize);
		var intoView = new Uint8Array(intoBuffer);
		var cursor=0;
		for(var chunkIndex=0; chunkIndex<list.length; chunkIndex++){
			var curList = list[chunkIndex];
			var curListView = new Uint8Array(curList);
			intoView.set(curListView,cursor);
			cursor += curListView.length;
		}
		return intoBuffer;
	}
	
	packBinary = function(data,format){
		
		var myBinaryChunks = [];
		for(var elementIndex=0; elementIndex<format.length; elementIndex++){
			
			var elementFormat = format[elementIndex];
			var elementData = data[elementFormat.name];
			
			if (elementFormat.count == DATACOUNT.array) {
				
				var prefixBuffer = new ArrayBuffer(4);
				var prefixView = new DataView(prefixBuffer);
				prefixView.setUint32(0,elementData.length,true);
				myBinaryChunks.push(prefixBuffer);
				
			}
			
			if (elementFormat.type == DATANUMTYPES.parent) {
				// parents should always be arrays (or else why would you even be using it)
				
				for(var childIndex=0; childIndex<elementData.length; childIndex++) myBinaryChunks.push(packBinary(elementData[childIndex],elementFormat.child));
				
			} else if (elementFormat.type == DATANUMTYPES.string) {
				
				// NOTE: THIS ASSUMES THAT THERE WILL NEVER BE ARRAYS OF STRINGS!!!
				// I'm not planning on using any SO THAT'S GOOD ENOUGH FOR ME FOR NOW.
				// frankly, anything that needs to be an array of strings can just be newline-joined or whatever anyway,
				// since this is already variable-length.
				// (there's no reason why I couldn't adapt the logic below to allow for variable-length stuff,
				// but it would be messy so I'm just not going to bother right now. oof.)
				
				var myTextEncoder = new TextEncoder();
				var binaryText = myTextEncoder.encode(elementData);
				
				// grossly redundant with array stuff above, sigh
				var prefixBuffer = new ArrayBuffer(4);
				var prefixView = new DataView(prefixBuffer);
				prefixView.setUint32(0,binaryText.length,true);
				myBinaryChunks.push(prefixBuffer);
				
				myBinaryChunks.push(binaryText);
				
			} else {
				
				var elementCount;
				switch(elementFormat.type){
					case DATANUMTYPES.integer:
					case DATANUMTYPES.float:
						elementCount = 1;
					break;
					case DATANUMTYPES.triple:
						elementCount = 3;
					break;
					case DATANUMTYPES.minimtx:
						elementCount = 10;
					break;
				}
				var elementSize;
				switch(elementFormat.type){
					case DATANUMTYPES.integer:
						elementSize = 4;
					break;
					case DATANUMTYPES.float:
					case DATANUMTYPES.triple:
					case DATANUMTYPES.minimtx:
						elementSize = 8;
					break;
				}
				var byteLength = elementCount*elementSize;
				if (elementFormat.count == DATACOUNT.array) byteLength = byteLength*elementData.length;//array's length, then the data
				
				var elementBinary = new ArrayBuffer(byteLength);
				var elementView = new DataView(elementBinary);
				
				function addElementDataToElementBinary(curElementData,offset){
					var curElementDataArray;
					switch(elementFormat.type){
						case DATANUMTYPES.integer:
						case DATANUMTYPES.float:
							curElementDataArray = [curElementData];
						break;
						case DATANUMTYPES.triple:
							curElementDataArray = [
								curElementData.x,
								curElementData.y,
								curElementData.z
							];
						break;
						case DATANUMTYPES.minimtx:
							curElementDataArray = [
								curElementData.p[0],
								curElementData.p[1],
								curElementData.p[2],
								curElementData.q[0],
								curElementData.q[1],
								curElementData.q[2],
								curElementData.q[3],
								curElementData.s[0],
								curElementData.s[1],
								curElementData.s[2]
							];
						break;
					}
					
					for(var i=0; i<curElementDataArray.length; i++){
						switch(elementFormat.type){
							case DATANUMTYPES.integer:
								elementView.setUint32((offset+i)*4,curElementDataArray[i],true);
							break;
							case DATANUMTYPES.float:
							case DATANUMTYPES.triple:
							case DATANUMTYPES.minimtx:
								elementView.setFloat64((offset+i)*8,curElementDataArray[i],true);
							break;
						}
					}
					
				}
				
				if (elementFormat.count == DATACOUNT.single) {
					
					addElementDataToElementBinary(elementData,0);
					myBinaryChunks.push(elementBinary);
					
				} else {
					
					for(var elementDataIndex=0; elementDataIndex<elementData.length; elementDataIndex++){
						var curElementData = elementData[elementDataIndex];
						addElementDataToElementBinary(curElementData,elementDataIndex*elementCount);
					}
					myBinaryChunks.push(elementBinary);
					
				}
				
			}
			
			
			
		}
		
		return concatArraybuffers(myBinaryChunks);
		
	}
	unpackBinary = function(binary,format,cursor){
		
		var data = {};
		cursor = cursor?cursor:{v:0};
		
		var binaryView = new DataView(binary);
		
		for(var elementIndex=0; elementIndex<format.length; elementIndex++){
			
			var elementFormat = format[elementIndex];
			
			var arrayLength;
			if (elementFormat.count == DATACOUNT.array) {
				arrayLength = binaryView.getUint32(cursor.v,true);
				cursor.v += 4;
			}
			
			if (elementFormat.type == DATANUMTYPES.parent) {
				
				var elementsArray = [];
				for(var arrayIndex=0; arrayIndex<arrayLength; arrayIndex++){
					elementsArray.push(unpackBinary(binary,elementFormat.child,cursor));
				}
				data[elementFormat.name] = elementsArray;
				
			} else if (elementFormat.type == DATANUMTYPES.string) {
				
				//redundant..
				var stringLength = binaryView.getUint32(cursor.v,true);
				cursor.v += 4;
				
				var stringBinary = new Uint8Array(binary,cursor.v,stringLength);
				cursor.v += stringLength;
				
				var myTextDecoder = new TextDecoder('utf-8');
				var theString = myTextDecoder.decode(stringBinary);
				
				data[elementFormat.name] = theString;
				
			} else {
				
				function getElementData(){
					var elementDataArray=[];
					
					var count;
					// this is redundant with the constructor, maybe make another enum...
					// though frankly this whole system is way redundant with the existing array system,
					// having a "doesn't need length specified" flag would be a lot smarter, sigh
					switch(elementFormat.type){
						case DATANUMTYPES.integer:
						case DATANUMTYPES.float:
							count = 1;
						break;
						case DATANUMTYPES.triple:
							count = 3;
						break;
						case DATANUMTYPES.minimtx:
							count = 10;
						break;
					}
					
					for(var dataIndex=0; dataIndex<count; dataIndex++){
						switch(elementFormat.type){
							case DATANUMTYPES.integer:
								elementDataArray.push(binaryView.getUint32(cursor.v,true));
								cursor.v += 4;
							break;
							case DATANUMTYPES.float:
							case DATANUMTYPES.triple:
							case DATANUMTYPES.minimtx:
								elementDataArray.push(binaryView.getFloat64(cursor.v,true));
								cursor.v += 8;
							break;
						}
					}
					
					var elementDataObject;
					switch(elementFormat.type){
						case DATANUMTYPES.integer:
						case DATANUMTYPES.float:
							elementDataObject = elementDataArray[0];
						break;
						case DATANUMTYPES.triple:
							elementDataObject = {
								x:elementDataArray[0],
								y:elementDataArray[1],
								z:elementDataArray[2]
							};
						break;
						case DATANUMTYPES.minimtx:
							elementDataObject = {
								p:[
									elementDataArray[0],
									elementDataArray[1],
									elementDataArray[2]
								],
								q:[
									elementDataArray[3],
									elementDataArray[4],
									elementDataArray[5],
									elementDataArray[6]
								],
								s:[
									elementDataArray[7],
									elementDataArray[8],
									elementDataArray[9]
								]
							}
						break;
					}
					return elementDataObject;
				}
				
				
				if (elementFormat.count == DATACOUNT.single) {
					
					data[elementFormat.name] = getElementData();
					
				} else {
					
					var dataArray = [];
					for(var arrayIndex=0; arrayIndex<arrayLength; arrayIndex++){
						dataArray.push(getElementData());
					}
					
					data[elementFormat.name] = dataArray;
					
				}
				
			}
			
			
			
		}
		
		return data;
		
	}
	
	
	
	
}

fileReady();
