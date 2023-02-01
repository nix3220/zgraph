const fs = require('fs');
const tokenizer = require("js-tokens");
const math = require("mathjs");
const openExplorer = require("open-file-explorer");

const FILE = "./index.zg"

let programLines = [];

let variables = [];
let functions = [];
let title = "My ZGraph";

class Variable{
    constructor(type){
        this.type = type;
    }
    toString(){
        return this.name;
    }
}

class Graph{
    constructor(lines){
        this.lines = lines;
    }
}

class Parameter{
    constructor(name, value, type){
        this.name = name;
        this.value = value;
        this.type = type;
    }
}

class Triangle extends Variable{
    constructor(name, points){
        super(name, "triangle");
        this.name = name;
        this.points = points;
    }
}

class Quadrilateral extends Variable{
    constructor(name, points){
        super(name, "quadrilateral");
        this.name = name;
        this.points = points;
    }
}

class Polygon extends Variable{
    constructor(name, points){
        super(name, "polygon");
        this.name = name;
        this.points = points;
    }
}

class LocalVariable{
    constructor(name, value, type){
        this.name = name;
        this.value = value;
        this.type = type;
    }
}

class Function{
    constructor(name,parameters, returnType, {start,end}){
        this.name = name;
        this.parameters = parameters;
        this.returnType = returnType;
        this.start = start;
        this.end = end;
        this.localVariables = [];
    }
}

class NumberVariable{
    constructor(name, value){
        this.name = name;
        this.value = value;
    }
    toString(){
        return this.value;
    }
}

class Point extends Variable{
    constructor(name,x,y){
        super(name, "point");
        this.name = name;
        this.x = x;
        this.y = y;
    }

    toString(){
        return "(" + this.x + "," + this.y + ")";
    }
}

class Segment extends Variable{
    constructor(name,points){
        super(name, "segment");
        this.name = name;
        this.points = points;
    }

    toString(){
        return "((" + this.point1.x + "," + this.point1.y + "),(" + this.point2.x + "," + this.point2.y + "))";
    }
}


InitLines()

function InitLines(){
    const file = fs.readFileSync(FILE, 'utf8');
    const lines = file.split('\n');

    if(file.includes("start") == false){
        console.log("No start function");
        return;
    }

    for (let i = 0; i < lines.length; i++) {
        //remove whitespace from the line
        //remove comments
        lines[i] = lines[i].replace(/\/\/.*/g, '');
        lines[i] = lines[i].replace(/\s/g, '');
        lines[i] = Array.from(tokenizer(lines[i]));
    }
    programLines = lines;
    FindAllFunctions();
}

function InitMainGraph(lines){
    for (let i = 0; i < lines.length; i++) {
        for (let j = 0; j < lines[i].length; j++) {
            if(lines[i][j].value == "{" && lines[i][j-1].value == "start"){
                let mainGraphRange = {start:{line:i,token:j}, end:FindNext(i,j,"}")};
                let mainGraph = new Graph(lines.slice(mainGraphRange.start.line+1,mainGraphRange.end.line));
                
                InterpretMainGraph(mainGraph);
            }
        }
    }
}

function FindAllFunctions(){
    for (let i = 0; i < programLines.length; i++) {
        for (let j = 0; j < programLines[i].length; j++) {
            if(programLines[i][j].value == "method"){
                let funcName = programLines[i][j+2].value;
                let funcParams = [];
                let paramStart = FindNext(i,j,"(");
                let paramEnd = FindNext(i,j,")");
                for (let k = paramStart.token+1; k < paramEnd.token; k++) {
                    if(programLines[paramStart.line][k].value != ","){
                        if(programLines[paramStart.line][k+1].value == ":"){
                            funcParams.push(new Parameter(programLines[paramStart.line][k].value,null,programLines[paramStart.line][k+2].value));
                        }
                    }
                }
                let funcRange = {start:FindNext(i,j,"{").line, end:FindNext(i,j,"}").line};
                let returnVal = programLines[i][paramEnd.token+2].value;
                functions.push(new Function(funcName,funcParams,returnVal, funcRange));
            }
        }
    }
    InitMainGraph(programLines);
}

function CallFunction(funcName, params){
    let func = functions.find(x => x.name == funcName);
    if(func == undefined){
        console.log("Function " + funcName + " not found");
        return;
    }
    for (let i = 0; i < func.parameters.length; i++) {
        func.parameters[i].value = params[i];
    }
    let funcGraph = new Graph(programLines.slice(func.start+1,func.end));
    return InterpretFunctionGraph(funcGraph, func);
}

function InterpretFunctionGraph(graph, func){

    for (let i = 0; i < graph.lines.length; i++) {
        for (let j = 0; j < graph.lines[i].length; j++) {
            if(graph.lines[i][j].value == "="){
                let lVar = HandleFunctionAssignment(graph.lines[i],j,func);
                if(lVar != undefined){
                    if(func.parameters.find(x => x.name == lVar.name) == undefined){
                        func.localVariables.push(lVar);
                    }
                    else{
                        func.parameters.find(x => x.name == lVar.name).value = lVar.value;
                    }
                }
            }
            else if(graph.lines[i][j].value == "return"){
                return HandleReturnValue(graph.lines[i].slice(j+2, graph.lines[i].length),func);
            }
        }
    }

}

function ConvertToMathAndEvaluateGlobal(line){
    let mathLine = "";
    for (let i = 0; i < line.length; i++) {
        if(variables.length > 0){
            if(variables.find(x => x.name == line[i].value) != undefined){
                mathLine += variables.find(x => x.name == line[i].value).value.toString();
            }
            else{
                mathLine += line[i].value;
            }
        }
        else{
            mathLine += line[i].value;
        }
    }
    mathLine = mathLine.replace("undefined", '');

    if(math.evaluate(mathLine) != undefined){
        return math.evaluate(mathLine);
    }
    else{
        console.log("Error evaluating math expression: " + mathLine);
        return;
    }
}

function ConvertToMathAndEvaluate(line, func){
    let mathLine = "";
    for (let i = 0; i < line.length; i++) {
        if(func.localVariables.find(x => x.name == line[i].value) != undefined){
            mathLine += func.localVariables.find(x => x.name == line[i].value).value.toString();
        }
        else if(func.parameters.find(x => x.name == line[i].value) != undefined){
            mathLine += func.parameters.find(x => x.name == line[i].value).value.toString();
        }
        else{
            mathLine += line[i].value;
        }
    }
    mathLine = mathLine.replace("undefined", '');

    if(math.evaluate(mathLine) != undefined){
        return math.evaluate(mathLine);
    }
    else{
        console.log("Error evaluating math expression: " + mathLine);
        return;
    }
}

function HandleReturnValue(line, func){
    if(line[0].value == "point")
    {
        let start = 0
        let breakPoint = 0
        let end = 0

        for (let i = 0; i < line.length; i++) {
            if(line[i].value == "("){
                start = i+1;
            }
            else if(line[i].value == ","){
                breakPoint = i;
            }
            else if(line[i].value == ")"){
                end = i;
            }
        }

        let xVal = line.slice(start,breakPoint);
        let yVal = line.slice(breakPoint+1,end);

        let x = ConvertToMathAndEvaluate(xVal, func);
        let y = ConvertToMathAndEvaluate(yVal, func);
        return new Point("N/A",x,y);
    }
    else{
        return ConvertToMathAndEvaluate(line, func);
    }
    
}

function HandleFunctionAssignment(line, token, func){
    let varName = line[token-1].value;
    let varValue;

    for (let i = token+1; i < line.length; i++) {
        if(func.localVariables.find(x => x.name == line[i].value) != undefined){
            varValue += func.localVariables.find(x => x.name == line[i].value).value.toString();
        }
        else if(func.parameters.find(x => x.name == line[i].value) != undefined){
            varValue += func.parameters.find(x => x.name == line[i].value).value.toString();
        }
        else{
            varValue += line[i].value;
        }
    }

    let varType = token-2 > 0 ? line[token-3].value : undefined;

    varValue = varValue.replace("undefined", '');

    if(math.evaluate(varValue) != undefined){
        varValue = math.evaluate(varValue);
    }
    
    return new LocalVariable(varName, varValue, varType);
}

function InterpretMainGraph(graph){
    for (let i = 0; i < graph.lines.length; i++) {
        for (let j = 0; j < graph.lines[i].length; j++) {
            if(graph.lines[i][j].value == "=" ||
             (graph.lines[i][j].value == ":" && graph.lines[i][j+1].value == "(") ||
             (graph.lines[i][j].value == ":" && graph.lines[i][j-1].value == ":")){
                HandleAssignment(graph.lines[i],j);
            }
            else if(graph.lines[i][j].value == "print"){
                HandlePrint(graph.lines[i],j);
            }
            else if(graph.lines[i][j].value == "export"){
                HandleExport(graph.lines[i],j);
            }
            else if(graph.lines[i][j].value == "title"){
                HandleTitle(graph.lines[i],j);
            }
            else if(graph.lines[i][j].value == "import"){
                HandleImport(graph.lines[i],j);
            }
            else if(graph.lines[i][j].value == "printVar"){
                HandlePrintVar(graph.lines[i],j);
            }
            else if(graph.lines[i][j].value == "call"){
                console.log("call");
                let assignedVarIndex = -1;
                let newVar;
                if(j-2 > 0){
                    if(VariableExists(graph.lines[i][j-2].value)){
                        assignedVarIndex = GetVariableIndex(graph.lines[i][j-2].value);
                    }
                }

                let funcName = graph.lines[i][j+2].value;
                let funcReturnType = functions.find(x => x.name == funcName).returnType;
                let params = [];
                let paramStart = FindNext(i,j,"(");
                let paramEnd = FindNext(i,j,")");
                
                for (let k = paramStart.token; k < paramEnd.token; k++) {
                    //get sections of the linme between commas
                    if(graph.lines[i][k].value == "," || graph.lines[i][k].value == "("){
                        let param;
                        console.log("fn: " + FindNextInLine(graph.lines[i],k,","));
                        if(FindNextInLine(graph.lines[i],k+1,",") != undefined){
                            let comma = FindNextInLine(graph.lines[i],k+1,",");
                            console.log("found comma at " + comma + " while k is: " + k);
                            param = graph.lines[i].slice(k+1,FindNextInLine(graph.lines[i],k+1,","));
                        }
                        else{
                            param = graph.lines[i].slice(k+1,paramEnd.token);
                        }
                        param = param.filter(x => x.value != "," && x.value != "(" && x.value != ")");
                        params.push(ConvertToMathAndEvaluateGlobal(param));
                        paramStart.token = k+1;
                    }
                }

                if(FindNextInLine(graph.lines[i],paramStart.token,",") == undefined){
                    console.log("no commas");
                    params.push(ConvertToMathAndEvaluateGlobal(graph.lines[i].slice(paramStart.token+1,FindNext(i,paramStart.token,",").token)));
                }

                params.forEach((param, index) => {
                    console.log(param);
                })

                let returnValue = CallFunction(funcName, params);
                
                if(funcReturnType != undefined){
                    if(funcReturnType == "point"){
                        newVar = new Point(graph.lines[i][j-2].value, returnValue.x, returnValue.y);
                    }
                    else if(funcReturnType == "number"){
                        newVar = new NumberVariable(graph.lines[i][j-2].value, returnValue);
                    }
                }

                if(assignedVarIndex != -1){
                    variables[assignedVarIndex] = newVar;
                }
                else{
                    variables.push(newVar);
                }
                variables = variables.filter(x => x != undefined && x != null);
            }
            variables = variables.filter(x => x != undefined && x != null);
        }
    }
}

function HandlePrintVar(line, j){

    console.log(JSON.stringify(variables, null, 2));
}

function HandleImport(line, j){
    let path = line[j+2].value;
    path = path.replace(/"/g, "");
    path = path.replace(/_/g, " ");

    if(fs.existsSync(path)){
        //push the imported graph to the variables array
        let arr = JSON.parse(fs.readFileSync(path))
        for(let i = 0; i < arr.length; i++){
            if(VariableExists(arr[i].name)){
                variables[GetVariableIndex(arr[i].name)] = arr[i];
                console.log("Overwrote variable " + arr[i].name + " during import from " + path);
            }
            else{
                variables.push(arr[i]);
            }
        }
    }
}

function HandleTitle(line, j){
    title = line[j+2].value;
    title = title.replace(/"/g, "");
    title = title.replace(/_/g, " ");
}

function HandleExport(line, j){
    let ext = title+".zgr.json"
    let path = line[j+2].value;
    path = path.replace(/"/g, "");
    path = path.replace(/_/g, " ");
    let graphToString = JSON.stringify(variables, null, 2);

    if(fs.existsSync(path)){
        fs.writeFileSync(path+ext, graphToString);
    }
    else{
        fs.mkdirSync(path, { recursive: true });
        fs.writeFileSync(path+ext, graphToString);
    }
    console.log("Exported to " + path + ext + " successfully!");
}

function HandlePrint(line, j){
    let output = ConvertToMathAndEvaluateGlobal(line.slice(j+2,FindNext(line,j+2,")")));
    //output = output.replace(/_/g, " ");
    console.log(output);
}

function FindNext(tokens, value){
    for (let i = tokens; i < tokens.length; i++) {
        if(tokens[i].value == value){
            return i;
        }
    }
    return -1
}

function GetVariable(name){
    for (let i = 0; i < variables.length; i++) {
        if(variables[i].name == name){
            return variables[i];
        }
    }
}

function GetVariableIndex(name){
    for (let i = 0; i < variables.length; i++) {
        if(variables[i].name == name){
            return i;
        }
    }
}

function GetPoints(line, token, numPoints){
    let points = [];
    let point = new Point();
    let pointNum = 0;
    let pointStart = token;
    let pointEnd = token;

    pointStart = FindNextInLine(line, token, "(");
    pointEnd = FindNextInLine(line, token, ")");
    if(pointStart != undefined && pointEnd != undefined){
        for(let i = pointStart; i <= pointEnd; i++){
            if(line[i].value == "," || line[i].value == ")"){
                point = new Point("N/A", GetVariable(line[i-1].value).x, GetVariable(line[i-1].value).y);
                points.push(point);
            }
        }
    }

    return numPoints > 0 ? points.slice(0,numPoints) : points;
}

function HandleAssignment(line, j){
    var newVariable;

    let varExists = VariableExists(line[j-1].value);
    let i = j-1;

    if(line[j+1].value == "seg" || line[j+1].value == "segment"){
        let points = GetPoints(line, j, 2);
        newVariable = new Segment(line[j-1].value, points);
        newVariable.type = "segment";
    }
    else if(line[j+1].value == "tri" || line[j+1].value == "triangle"){
        let points = GetPoints(line, j, 3);
        newVariable = new Triangle(line[j-1].value, points);
        newVariable.type = "triangle";
    }
    else if(line[j+1].value == "quad" || line[j+1].value == "quadrilateral"){
        let points = GetPoints(line, j, 4);
        newVariable = new Quadrilateral(line[j-1].value, points);
        newVariable.type = "quadrilateral";
    }
    else if(line[j+1].value == "poly" || line[j+1].value == "polygon"){
        let points = GetPoints(line, j, -1);
        newVariable = new Polygon(line[j-1].value, points);
        newVariable.type = "polygon";
    }
    else if(line[j+1].value == "call"){

    }
    else if(line[j+1].value == "point"){
        let p = HandleDynamicPoint(line, j);
        newVariable = new Point(line[j-1].value, p.x, p.y);
        newVariable.type = "point";
    }
    else if(line[j].value == ":" && line[j+1].value == "("){
        varExists = VariableExists(line[j-2].value);
        i = j-2;
        let p = HandleDynamicPoint(line, j);
        newVariable = new Point(line[j-2].value, p.x, p.y);
        newVariable.type = "point";
    }
    else if(line[j+1].value == "("){
        let p = HandleDynamicPoint(line, j);
        newVariable = new Point(line[j-1].value, p.x, p.y);
        newVariable.type = "point";
    }
    else if(line[j].value == ":" && line[j-1].value == ":"){
        varExists = VariableExists(line[j+1].value);
        i = j+1;
        let p = HandleDynamicPoint(line, j);
        newVariable = new Point(line[j+1].value, p.x, p.y);
        newVariable.type = "point";
    }
    else{
        if(ConvertToMathAndEvaluateGlobal(line.slice(j+1, line.length)) != undefined){
            newVariable = new NumberVariable(line[j-1].value, ConvertToMathAndEvaluateGlobal(line.slice(j+1, line.length)));
        }
        else{
            newVariable = new NumberVariable(line[j-1].value, 0);
        }
        newVariable.type = "number";
    }
    if(varExists){
        console.log("Variable already exists, overwriting");
        variables[GetVariableIndex(line[i].value)] = newVariable;
    }
    else{
        variables.push(newVariable);
    }
}

function HandleDynamicPoint(line, j){
    let start = 0
        let breakPoint = 0
        let end = 0

        for (let i = 0; i < line.length; i++) {
            if(line[i].value == "("){
                start = i+1;
            }
            else if(line[i].value == ","){
                breakPoint = i;
            }
            else if(line[i].value == ")"){
                end = i;
            }
        }

        let xVal = line.slice(start,breakPoint);
        let yVal = line.slice(breakPoint+1,end);

        let x = ConvertToMathAndEvaluateGlobal(xVal);
        let y = ConvertToMathAndEvaluateGlobal(yVal);

        return {x: x, y: y};
}


function VariableExists(name){
    for (let i = 0; i < variables.length; i++) {
        if(variables[i].name == name){
            return true;
        }
    }
    return false;
}

function FindNextInLine(tokens, position, str){
    for (let j = position; j < tokens.length; j++) {
        if(tokens[j].value == str){
            return j;
        }
    }
    return undefined
}

function FindNext(outer, inner, str){
    let inLine = true;

    for (let i = outer; i < programLines.length; i++) {
        for (let j = inLine ? inner : 0; j < programLines[i].length; j++) {
            if(programLines[i][j].value == str){
                return {line:i,token:j}
            }
        }
        inLine = false;
    }
    return undefined
}

