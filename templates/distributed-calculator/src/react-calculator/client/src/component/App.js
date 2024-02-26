import React from "react";
import Display from "./Display";
import ButtonPanel from "./ButtonPanel";
import calculate from "../logic/calculate";
import "./App.css";

export default class App extends React.Component {
  state = {
    value:''
  };

  async componentDidMount() {
    this.setState({ value: '' });
  }

  handleClick = async (buttonName) => {
    let value = await calculate(this.state, buttonName);
    this.setState(value);
  };

  render() {
    return (
      <div className="component-app">
        <Display value={this.state.value || "0"} />
        <ButtonPanel clickHandler={this.handleClick} />
      </div>
    );
  }
}
