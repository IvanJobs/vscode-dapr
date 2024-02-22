

import operate from "./operate";

/**
 * Given a button name and a calculator data object, return an updated
 * calculator data object.
 *
 */
export default async function calculate(obj, buttonName) {
  if (buttonName === "AC") {
    return {
      value: ''
    };
  }
  if (buttonName === "<-") {
    if (obj.value.length === 1) {
      return {
        value: ''
      };
    }
    else {
      return {
        value: obj.value.slice(0, -1)
      };
    }
  }
  if (buttonName === "=") {
    const res =await calculateMathString(obj.value);
    return {
      value: res.toString()
    };

  }
  return {
    value: obj.value + buttonName,
  };
}

export async function calculateMathString(mathString) {
  let num = '';
  let prevVal = '0';
  let operation = null;

  for (let i = 0; i < mathString.length; i++) {
    if ('0123456789.'.includes(mathString[i])) {
      num += mathString[i];
    } else if ('+-x/'.includes(mathString[i])) {
      prevVal = (await cal(prevVal, num, operation)).toString();
      operation = mathString[i];
      num = '';
    }
  }

  return await cal(prevVal, num, operation);
}
async function cal(val1, val2, operation) {
  if(!operation) return val2;
  return await operate(val1.toString(), val2, operation);
}