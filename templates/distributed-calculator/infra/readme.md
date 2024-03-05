az login

az account set --subscription 7944fc49-1409-4710-b47e-69661eb1770b

az group create --location eastus --resource-group testing0303

cd .\src\node-addition\

az acr build --registry testing03032116containerregistry --image additionapp:latest .

cd .\src\python-subtraction\

az acr build --registry testing03032116containerregistry --image subtractionapp:latest .

cd .\src\react-calculator\

az acr build --registry testing03032116containerregistry --image calculatorapp:latest .

az deployment group create --name deployment0303 --resource-group testing0303 --template-file .\infra\allinone.bicep --parameters resourcePrefix="testing03032116"
