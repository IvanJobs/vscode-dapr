const operationMap = {
  "+": "add",
  "-": "subtract",
};

export default async function operate(operandOne, operandTwo, operationSymbol) {

  operandOne = operandOne + '';
  operandTwo = operandTwo + '';

  const operation = operationMap[operationSymbol];
  console.log(`Calling ${operation} service`);

  const rawResponse = await fetch(`/calculate/${operation}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operandOne,
      operandTwo
    }),
  });
  const response = await rawResponse.json();

  return response.toString();
}