
import React, { Component } from "react";
import { render } from "react-dom";
import { AgGridReact } from "@ag-grid-community/react";
import { AllModules } from "@ag-grid-enterprise/all-modules";
import { AllCommunityModules } from "@ag-grid-community/all-modules";

import axios from 'axios';

class App extends Component {
  constructor(props) {
    super(props);
    
    // Add a request interceptor
    axios.interceptors.request.use(function (config) {
        // Do something before request is sent
        config.auth = {
          username: '',
          password: ''
        }
        return config;
      }, function (error) {
        // Do something with request error
        return Promise.reject(error);
      });


    this.state = {
      modules: AllModules,
      suppressAggFuncInHeader: true,
      rowSelection: 'single',
      masterDetail: true,
      setFilter: function () { 
        var sd = new Date().toISOString().split('T')[0]
        return {
              CreateDate: {
                type: 'set',
                values: [sd]
              }
          }
      },
      columnDefs: [
        {
          headerName: "CreateDate",
          field: "CreateDate",
          width: 145,
          cellRenderer: "agGroupCellRenderer"
        },
        {
          headerName: "BranchID",
          field: "BranchID",
          width: 90,
        },
        {
          headerName: "Area",
          field: "Area",
          width: 90,
          valueGetter: function(params) {
            return params.data.RouteID.substring(0,3);
          }
        },
        {
          headerName: "RouteID",
          field: "RouteID",
          width: 90
        },
        {
          headerName: "GRV",
          field: "GRV",
          width: 90,
          aggFunc: "sum",
          valueGetter: function(params) {
            //console.log(params);
            var val = parseInt(params.data.GRV);
            return val > 1 ? 1:val;
          },
          cellStyle: function(params) {
              if (params.value<1) 
                return {color: 'black', backgroundColor: 'tomato'};
              else
                return {color: 'black', backgroundColor: 'lightgreen'};
          }
        },
        {
          headerName: "Deliveries",
          field: "Deliveries",
          width: 90,
          valueGetter: function(params) {
            return parseInt(params.data.Deliveries);
          }
        },
        
        {
          headerName: "POD",
          field: "POD",
          width: 90,
          cellStyle: function(params) {
              if (params.value == 0 && params.data.GRV<1)
                  return null;  
              else if (params.value/params.data.Deliveries > 0.9) 
                return {color: 'black', backgroundColor: 'lightgreen'};    
              else if (params.value/params.data.Deliveries > 0.8) 
                return {color: 'black', backgroundColor: 'yellow'};
              else
                return {color: 'black', backgroundColor: 'tomato'};
          } 
        },
        {
          headerName: "Returns",
          field: "Returns",
          width: 90,
          filter: "agNumberColumnFilter",
          cellStyle: function(params) {
                if (params.value<1) 
                return {color: 'black', backgroundColor: 'tomato'};
              else
                return {color: 'black', backgroundColor: 'lightgreen'};
          } 
        },
        {
          headerName: "Offloads",
          field: "Offloads",
          width: 90,
          filter: "agNumberColumnFilter",
          cellStyle: function(params) {
                if (params.value<1) 
                return {color: 'black', backgroundColor: 'tomato'};
              else
                return {color: 'black', backgroundColor: 'lightgreen'};
          } 
        },
        {
          headerName: "NumPosted",
          field: "NumPosted",
          width: 90,
          filter: "agNumberColumnFilter",
          hide: true
        },
        {
          headerName: "NumTransactions",
          field: "NumTransactions",
          width: 90,
          filter: false,
          hide: true
        },
        {
          headerName: "Post %",
          field: "PostP",
          width: 90,
          filter: false,
          valueGetter: function(params) {
            if (params.data.NumPosted)
              return parseInt(parseInt(params.data.NumPosted)/parseInt(params.data.NumTransactions)*100);
            else 
              return ''
          },
          cellStyle: function(params) {
              if (!params.value) return null;
              if (params.value<95) 
                return {color: 'black', backgroundColor: 'tomato'};
              else if (params.value<99) 
                return {color: 'black', backgroundColor: 'yellow'};  
              else
                return {color: 'black', backgroundColor: 'lightgreen'};
          } 
        }
      ],
      defaultColDef: { sortable: true, filter: true, tooltipComponent: "customTooltip" },
      rowData: null,
      detailCellRendererParams: {
        detailGridOptions: {
          columnDefs: [
            { field: "RouteID", hide:true },
            { field: "CreateDate", hide:true },
            { field: "Time", tooltipField: "Time", tooltipComponent: "customTooltip" },
            { field: "Type" },
            { field: "AccountID" },
            { field: "Name" },
            { field: "Quantity" },
            { field: "Type" },
            { field: "Value" },
            { field: "User" },
            {
              headerName: "Child/Parent",
              field: "value",
              cellRenderer: "DrillDownButton",
              colId: "params",
              width: 180
            }
          ],
          onFirstDataRendered: function(params) {
            params.api.sizeColumnsToFit();
          }
        },
        getDetailRowData: function(params) {
          var url = 'https://citric-optics-107909.appspot.com/query/run?name=RouteTransactions&format=json&CreateDate=' + params.data.CreateDate + '&RouteID=' + params.data.RouteID 
          axios.get(url)
            .then(function (response) {
              //console.log(response.data);
              params.successCallback(response.data);
            })
            .catch(function (error, msg) {
              alert(error.response.data);
            });   
        }
      }
    };
  }

  setfilter = () => {
    if (!this.state.setFilter) return;
    // Get a reference to the name filter instance
    this.gridApi.setFilterModel(this.state.setFilter());
    this.gridApi.onFilterChanged();    
  }


  onGridReady = params => {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
    
    const updateData = data => {
      this.setState({ rowData: data });
      this.setfilter();
    };
    
    axios.get('https://citric-optics-107909.appspot.com/query/run?name=RouteTransactionsDaySummary&format=json')
      .then(function (response) {
        updateData(response.data);
      })
      .catch(function (error) {
        alert(error);
      });   
  };

  render() {
    return (
      <div style={{ width: "1080px", height: "1080px" }}>
        <button onClick={this.setfilter.bind(this)}>Today</button>
        <div
          id="myGrid"
          style={{
            height: "1080px",
            width: "1080px"
          }}
          className="ag-theme-balham"
        >
          <AgGridReact
            modules={this.state.modules}
            columnDefs={this.state.columnDefs}
            defaultColDef={this.state.defaultColDef}
            rowData={this.state.rowData}
            suppressAggFuncInHeader={this.state.suppressAggFuncInHeader}
            onGridReady={this.onGridReady}
            detailCellRendererParams={this.state.detailCellRendererParams}
            masterDetail={this.state.masterDetail}
            frameworkComponents={this.state.frameworkComponents}
          />
        </div>
      </div>
    );
  }
  

}


export default App;