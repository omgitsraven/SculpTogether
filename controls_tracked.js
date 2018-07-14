function SETUP_tracked(){
	
	
	
	
	
	
	
	var axesHolder = new THREE.Object3D();
	
	var axisRodRad = 0.005;
	var axisRodStart = 0.1;
	var axisRodEnd = 0.2;
	
	var axisMeshes = [];
	var axisRots = {};
	function makeAxis(label,rot){
		
		
		var curAxisHolder = new THREE.Object3D();
		curAxisHolder.rotation.copy(rot);
		axesHolder.add(curAxisHolder);
		
		
		var curAxisSplitHolder = new THREE.Object3D();
		var curAxisDimMat = new THREE.MeshBasicMaterial({color:0x888888});
		
		var axisHalves = [];
		for(var i=-1; i<=1; i+=2){
			var axisHalfMesh = new THREE.Mesh(
				new THREE.CylinderGeometry(axisRodRad,axisRodRad,axisRodEnd-axisRodStart,8,1),
				curAxisDimMat
			);
			axisHalfMesh.rotation.z = Math.PI/2*i;
			axisHalfMesh.position.x = (axisRodEnd+axisRodStart)/2*i;
			curAxisSplitHolder.add(axisHalfMesh);
			axisHalves.push(axisHalfMesh);
		}
		
		var dimAxisMesh = mergeObjects(axisHalves,curAxisSplitHolder,curAxisDimMat);
		curAxisHolder.add(dimAxisMesh);
		
		
		var litAxisMesh = new THREE.Mesh(
			new THREE.CylinderGeometry(axisRodRad,axisRodRad,axisRodEnd*2,8,1),
			new THREE.MeshBasicMaterial({color:0xFFFFFF})
		);
		litAxisMesh.rotation.z = Math.PI/2;
		curAxisHolder.add(litAxisMesh);
		
		
		axisMeshes.push({
			label:label,
			dim:dimAxisMesh,
			lit:litAxisMesh
		});
		axisRots[label] = rot;
		
	}
	makeAxis('x',new THREE.Euler(0,0,0));
	makeAxis('y',new THREE.Euler(0,0,Math.PI/2));
	makeAxis('z',new THREE.Euler(0,-Math.PI/2,0));
	
	
	
	function getDominantHandPointWorldPos(handOffsetVec){
		
		var domHandBone = bones[dominantHand];
		
		if (dominantHand == "Left") {
			//this assumes a fresh vector for every call!!
			//which, is the case right now, but it's honestly kind of wasteful..
			//so if I ever fix that -- MULTIPLY A COPY OR WHATEVER
			handOffsetVec.x *= -1;
		}
		
		handOffsetVec.applyQuaternion(domHandBone.quaternion);
		handOffsetVec.add(domHandBone.position);
		
		return handOffsetVec;
		
	}
	function getDominantPalmWorldPos(){
		return getDominantHandPointWorldPos(new THREE.Vector3(0,0,0.08));
	}
	function getDominantPalmAxisLocalPos(){
		
		// since it's relative-only, I could probably get away with only transforming it by the rotation,
		// but whatever, let's not overthink this, I don't think math is any kind of bottleneck here
		axesHolder.updateMatrix();
		var axesMtxInv = new THREE.Matrix4().getInverse(axesHolder.matrix);
		
		var worldPos = getDominantPalmWorldPos();
		worldPos.applyMatrix4(axesMtxInv);
		
		return worldPos;
		
	}
	
	function getDominantAxisLocalQuat(){
		
		var handQuat = bones[dominantHand].quaternion.clone();
		var axesQuatInv = axesHolder.quaternion.clone().inverse();//cache this?
		handQuat.premultiply(axesQuatInv);
		return handQuat;
		
	}
	
	
	
	var dragging = false;
	var grabStartVal;
	var focusedAxis;
	
	function updateAxesPos(){
		scene.add(axesHolder);
		axesHolder.position.copy(getDominantPalmWorldPos());
	}
	function updateAxesRot(){
		switch(curMode){
			case EDITMODES.Slide:
				axesHolder.quaternion.set(0,0,0,1);
			break;
			case EDITMODES.Turn:
			case EDITMODES.Stretch:
				var copyFrom = (selectedArtMesh.artType == ARTTYPES.mannequin) ? selectedArtMesh.myHolder : selectedArtMesh ;
				axesHolder.quaternion.copy( copyFrom.quaternion );
			break;
		}
		if (selectedArtMesh.artType == ARTTYPES.costume) axesHolder.quaternion.premultiply( selectedArtMesh.myMannequinMesh.myHolder.quaternion );
	}
	var debugDot = new THREE.Mesh( new THREE.SphereGeometry(0.01), new THREE.MeshBasicMaterial({color:0xFF0000}) );
	//axesHolder.add(debugDot);
	function updateAxesSelection(){
		var handQuat = getDominantAxisLocalQuat();
		var handVec = new THREE.Vector3(1,0,0);
		handVec.applyQuaternion(handQuat);
		debugDot.position.copy(handVec);
		debugDot.position.multiplyScalar(0.05);
		var majAxis = 'x';
		var axes = ['y','z'];
		for(var i=0; i<axes.length; i++){
			var curAxis = axes[i];
			if (Math.abs(handVec[curAxis]) > Math.abs(handVec[majAxis])) majAxis=curAxis;
		}
		focusedAxis = majAxis;
		for(var i=0; i<axisMeshes.length; i++){
			var curMeshes = axisMeshes[i];
			curMeshes.lit.visible = (curMeshes.label==focusedAxis);
			curMeshes.dim.visible = !curMeshes.lit.visible;
		}
	}
	
	
	function getAxisHandOffset(axisLabel){
		
		var handLocalPos = getDominantPalmAxisLocalPos();
		
		return handLocalPos[axisLabel];
		
	}
	function getAxisHandAngle(axisLabel){
		
		var handQuat = getDominantAxisLocalQuat();
		
		var axisQuat = new THREE.Quaternion().setFromEuler(axisRots[axisLabel]).inverse();//this could be sped up..
		handQuat.premultiply(axisQuat);
		
		var turnVec = new THREE.Vector3(0,1,0);
		turnVec.applyQuaternion(handQuat);
		
		return -Math.atan2(turnVec.y,turnVec.z);
		
	}
	
	function getCurrentDragAmt(){
		return (curMode==EDITMODES.Turn) ? getAxisHandAngle(focusedAxis) : getAxisHandOffset(focusedAxis) ;
	}
	
	
	
	
	
	var pads;
	var bones = {};
	
	var curMode;
	
	var GRIPINDEX = 1;
	
	// Call immediately to indicate that we want gamepad updates
	altspace.getGamepads();
	
	
	
	
	
	function isButtonPressed(buttonIndex){
		
		if (!pads) return false;
		
		return pads[dominantHand].buttons[buttonIndex].pressed;
		
	}
	function isGripPressed(){
		return isButtonPressed(GRIPINDEX);
	}
	
	
	
	
	
	
	var lastGrabMtx;
	var wasGrabbing = false;
	var wasDoubleGrabbing = false;
	
	
	return {
		
		label:"tracked",
		
		isAvailable:function(){
			
			
			var gamepadsList = altspace.getGamepads();//always ask regardless of anything
			
			
			
			if (pads) return true;
			
			if (gamepadsList.length < 2) {
				//console.log("tracked unavailable because ONLY",gamepadsList.length,"PADS");
				return false;
			}
			
			
			var padL, padR;
			
			for(var i=0; i<gamepadsList.length; i++) {
				var curPadInfo = gamepadsList[i];
				switch(curPadInfo.mapping){
					case "standard":
						continue;
					case "touch":
					case "steamvr":
						this.mapping = curPadInfo.mapping;
						if (curPadInfo.hand == "left") {
							padL = curPadInfo;
						} else {
							padR = curPadInfo;
						}
						break;
					default:
						console.log("UNKNOWN CONTROLLER TYPE??",curPadInfo.mapping);
						break;
				}
			}
			
			if (!padL || !padR || !padL.connected || !padR.connected) {
				//console.log("tracked unavailable because THERE'S",gamepadsList.length,"PADS, BUT NO HANDEDNESS");
				return false;
			}
			
			pads = {
				Right:padR,
				Left:padL
			};
			return true;
			
		},
		
		open:function(){
			// NOTE: because there is no going back from tracked controls,
			// I'm not going to bother actually implementing anything for open/close.
			// but, if something can eventually supercede tracked controls,
			// COME IN HERE AND MAKE SURE IT CLEANS UP AFTER ITSELF
		},
		
		close:function(){
			
		},
		
		modeSwitch:function(newMode){
			
			switch(curMode){
				case EDITMODES.Draw:
				
				break;
				case EDITMODES.Shape:
				
				break;
				case EDITMODES.Erase:
					
				break;
				case EDITMODES.Grab:
					
				break;
				case EDITMODES.Slide:
				case EDITMODES.Turn:
				case EDITMODES.Stretch:
					scene.remove(axesHolder);
				break;
				case EDITMODES.Save:
				case EDITMODES.Load:
				case EDITMODES.Moderation:
				case EDITMODES.Disabled:
					
				break;
			}
			
			curMode = newMode;
			
			switch(newMode){
				case EDITMODES.Draw:
				
				break;
				case EDITMODES.Shape:
				
				break;
				case EDITMODES.Erase:
					
				break;
				case EDITMODES.Grab:
					
				break;
				case EDITMODES.Slide:
				case EDITMODES.Turn:
				case EDITMODES.Stretch:
					
				break;
				case EDITMODES.Save:
				case EDITMODES.Load:
				case EDITMODES.Moderation:
				case EDITMODES.Disabled:
					
				break;
			}
			
		},
		
		frameFunc:function(){
			
			if (!bones.Right) {
				bones = {
					Right:skeletonInfo.getJoint('Hand','Right',0),
					Left:skeletonInfo.getJoint('Hand','Left',0)
				};
			}
			
			switch(curMode){
				case EDITMODES.Draw:
					
				break;
				case EDITMODES.Shape:
					
				break;
				case EDITMODES.Erase:
					
				break;
				case EDITMODES.Grab:
					
				break;
				case EDITMODES.Slide:
				case EDITMODES.Turn:
				case EDITMODES.Stretch:
					
					if (selectedArtMesh) {
						
						if (!dragging) {
							
							updateAxesPos();
							updateAxesRot();
							updateAxesSelection();
							
							if (isGripPressed()) {
								latestDragAmt = grabStartVal = getCurrentDragAmt();
								dragging = true;
								//console.log("GRIP AXIS:",focusedAxis);
							}
							
						} else {
							
							latestDragAmt = getCurrentDragAmt();
							if (!isGripPressed()) dragging = false;
							
						}
						
					}
					
				break;
				case EDITMODES.Save:
				case EDITMODES.Load:
				case EDITMODES.Moderation:
				case EDITMODES.Disabled:
					
				break;
			}
			
		},
		frameEnd:function(){
			
		},
		
		getDominantPointing:function(){
			
			if (curMode == EDITMODES.Shape || !pads) return false;
			
			var domPad = pads[dominantHand];
			
			//this test should probably be moved into sculpt.js
			if ( (curMode == EDITMODES.Draw) && (!isGripPressed()) ) return false;
			
			
			return {
				fingerPos:getDominantHandPointWorldPos(new THREE.Vector3(0.04,0,0.19)),
				fingerQuat:new THREE.Quaternion().copy(domPad.rotation)
			};
			
		},
		
		getBothPinching:function(){
			
			if (!pads) return false;
			if ( !(curMode == EDITMODES.Shape || curMode == EDITMODES.Save) ) return false;
			
			if (!pads.Right.buttons[GRIPINDEX].pressed) return false;
			if (!pads.Left.buttons[GRIPINDEX].pressed) return false;
			
			var rightQuat = new THREE.Quaternion().copy(pads.Right.rotation);
			var leftQuat = new THREE.Quaternion().copy(pads.Left.rotation);
			
			var rightPinch = new THREE.Vector3().copy(pads.Right.position);
			var leftPinch = new THREE.Vector3().copy(pads.Left.position);
			
			var offX = 0.015;
			var offY = -0.05;
			
			var rightOff = new THREE.Vector3(offX,offY,0);
			rightOff.applyQuaternion(rightQuat);
			rightPinch.add(rightOff);
			
			var leftOff = new THREE.Vector3(-offX,offY,0);
			leftOff.applyQuaternion(leftQuat);
			leftPinch.add(leftOff);
			
			return {
				rightPinch:rightPinch,
				leftPinch:leftPinch,
				rightQuat:rightQuat,
				leftQuat:leftQuat,
				spawnMargin:0.5
			};
			
		},
		
		refreshArtSelected:function(){
			
		},
		updateEnabledness:function(){
			
		},
		
		getIsStretching:function(){
			return dragging;
		},
		getTransformAxis:function(){
			return focusedAxis;
		},
		getDragProgressAmt:function(){
			return latestDragAmt - grabStartVal;
		},
		
		selectedArtTransformed:function(){
			
			if (curMode==EDITMODES.Turn) {
				var oldVal = getCurrentDragAmt();
				updateAxesRot();
				var newVal = getCurrentDragAmt();
				grabStartVal += (newVal-oldVal);
			}
			
			
		},
		
		
		getIsGrabbing:function(){
			return pads.Right.buttons[GRIPINDEX].pressed || pads.Left.buttons[GRIPINDEX].pressed ;
		},
		
		getGrabIncrementMtx:function(){
			
			var grabR = pads.Right.buttons[GRIPINDEX].pressed;
			var grabL = pads.Left.buttons[GRIPINDEX].pressed;
			
			if (!grabR && !grabL) return;
			
			var isDoubleGrabbing = (grabR && grabL);
			var newGrabMtx = new THREE.Matrix4();
			
			if (isDoubleGrabbing) {//scaling grab
				
				var middlePos = new THREE.Vector3().copy(pads.Right.position);
				middlePos.lerp( pads.Left.position, 0.5 );
				
				var middleQuat = new THREE.Quaternion().copy(pads.Right.rotation);
				middleQuat.slerp( new THREE.Quaternion().copy(pads.Left.rotation), 0.5 );
				
				var gapDist = new THREE.Vector3().copy(pads.Right.position).distanceTo( new THREE.Vector3().copy(pads.Left.position) );
				gapDist = Math.max(gapDist,0.00001);//almost certainly unnecessary but no harm being cautious
				
				newGrabMtx.compose( middlePos, middleQuat, new THREE.Vector3(gapDist,gapDist,gapDist) );
				
			} else {//nonscaling grab
				
				var grabbingHand = grabR ? pads.Right : pads.Left ;
				
				newGrabMtx.compose( grabbingHand.position, grabbingHand.rotation, new THREE.Vector3(1,1,1) );
				
			}
			
			if (selectedArtMesh.artType == ARTTYPES.costume) {
				selectedArtMesh.myMannequinMesh.myHolder.updateMatrix();//?
				var holderInvMtx = new THREE.Matrix4().getInverse(selectedArtMesh.myMannequinMesh.myHolder.matrix);
				newGrabMtx.premultiply(holderInvMtx);
			}
			
			if ( !wasGrabbing || (wasDoubleGrabbing != isDoubleGrabbing) ) lastGrabMtx = newGrabMtx;//could just return the identity instead, but w/e
			
			var diffMtx = newGrabMtx.clone();
			diffMtx.multiply( new THREE.Matrix4().getInverse(lastGrabMtx) );
			
			wasGrabbing = true;
			wasDoubleGrabbing = isDoubleGrabbing;
			lastGrabMtx = newGrabMtx;
			
			return diffMtx;
			
		},
		grabStopped:function(){
			wasGrabbing = false;
		},
		
		strokeMinDist:0.01
		
		
	};
	
}

fileReady();
