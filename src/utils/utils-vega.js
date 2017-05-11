export function notNull (value) { return value != null /* double-equals also catches undefined */ }

function shadeColor (color, percent, opacity) {
  const f = parseInt(color.slice(1), 16),
    t = percent < 0 ? 0 : 255,
    p = percent < 0 ? percent * -1 : percent,
    R = f >> 16,
    G = f >> 8 & 0x00FF,
    B = f & 0x0000FF,
    newHex = `#${(0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1)}`
  return convertHexToRGBA(newHex, opacity)
}

function convertHexToRGBA (hex, opacity) {
  hex = hex.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return `rgba(${r},${g},${b},${opacity / 100})`
}

export function createVegaAttrMixin (layerObj, attrName, defaultVal, nullVal, useScale, prePostFuncs) {
  let scaleFunc = "", fieldAttrFunc = ""
  const capAttrName = attrName.charAt(0).toUpperCase() + attrName.slice(1)
  const defaultFunc = "default" + capAttrName
  const nullFunc = "null" + capAttrName
  layerObj[defaultFunc] = createRasterLayerGetterSetter(layerObj, defaultVal, (prePostFuncs ? prePostFuncs.preDefault : null), (prePostFuncs ? prePostFuncs.postDefault : null))
  layerObj[nullFunc] = createRasterLayerGetterSetter(layerObj, nullVal, (prePostFuncs ? prePostFuncs.preNull : null), (prePostFuncs ? prePostFuncs.postNull : null))

  if (useScale) {
    scaleFunc = attrName + "Scale"
    fieldAttrFunc = attrName + "Attr"
    layerObj[scaleFunc] = createRasterLayerGetterSetter(layerObj, null, (prePostFuncs ? prePostFuncs.preScale : null), (prePostFuncs ? prePostFuncs.postScale : null))
    layerObj[fieldAttrFunc] = createRasterLayerGetterSetter(layerObj, null, (prePostFuncs ? prePostFuncs.preField : null), (prePostFuncs ? prePostFuncs.postField : null))

    layerObj["_build" + capAttrName + "Scale"] = function (chart, layerName) {
      const scale = layerObj[scaleFunc]()
      if (scale && scale.domain && scale.domain().length && scale.range().length && scaleFunc === "fillColorScale") {
        const colorScaleName = layerName + "_" + attrName
        const rtnObj = {
          name: colorScaleName,
          type: chart._determineScaleType(scale),
          domain: scale.domain().filter(notNull),
          range: scale.range(),
          default: layerObj[defaultFunc](),
          nullValue: layerObj[nullFunc]()
        }

        if (scale.clamp) {
          rtnObj.clamp = scale.clamp()
        }

        return rtnObj
      } else if (layerObj.densityAccumulatorEnabled()) {
        const colorScaleName = layerName + "_" + attrName
        const selectedColors = layerObj.defaultFillColor()
        const rtnObj = {
          name: colorScaleName,
          type: "linear",
          domain: [0.0, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1],
          range: selectedColors.map((color, i) => shadeColor(color, 0, i + 90)),
          accumulator: "density",
          minDensityCnt: "-2ndStdDev",
          maxDensityCnt: "1stStdDev"
        }
        return rtnObj
      }
    }
  }

  const getValFunc = "get" + capAttrName + "Val"
  layerObj[getValFunc] = function (input) {
    let rtnVal = layerObj[defaultFunc]()
    if (input === null) {
      rtnVal = layerObj[nullFunc]()
    } else if (input !== undefined && useScale) {
      const scaleObj = layerObj[scaleFunc]()
      if (scaleObj && scaleObj.domain && scaleObj.domain().length && scaleObj.range().length) {
        rtnVal = scaleObj(input)
      }
    }

    return rtnVal
  }
}

export function createRasterLayerGetterSetter (layerObj, attrVal, preSetFunc, postSetFunc) {
  return function (newVal) {
    if (!arguments.length) {
      return attrVal
    }
    if (preSetFunc) {
      var rtnVal = preSetFunc(newVal, attrVal)
      if (rtnVal !== undefined) {
        newVal = rtnVal
      }
    }
    attrVal = newVal
    if (postSetFunc) {
      var rtnVal = postSetFunc(attrVal)
      if (rtnVal !== undefined) {
        attrVal = rtnVal
      }
    }
    return layerObj
  }
}
