import React, { Component } from "react";
import PropTypes from 'prop-types';
import prefixAll from 'inline-style-prefixer/static';
import { Card } from 'material-ui/Card';
import classNames from 'classnames/bind';
import Loader from "../Loader/Loader";
import AppBar from 'material-ui/AppBar';
import IconButton from 'material-ui/IconButton';
import {hashHistory} from 'react-router';
import axios from 'axios';
import LastRefreshedLabel from './../common/LastRefreshedLabel';
import {  fetchReport, runQuery, fetchQueryDataByURL, fetchReports, runQueryViaParams } from '../../tools/dataHandler';
import {values, keys, fo} from 'lodash';

import DrillDownButton from '../drilldownbutton/DrillDownButtonComponent';
import outerStyles from './GridReport.scss';
import Error from '../error/Error';


import { AgGridReact } from "@ag-grid-community/react";
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';
import 'ag-grid-enterprise';
import { AllModules }  from '@ag-grid-enterprise/all-modules';

//TODO: REFACTOR CODE DONE IN RUSH TO GET VARIOUS GRID ITEMS WORKING FOR GOLIIVE 


//Setup the inline style prefixes for the grid
const styles = prefixAll({
    chart: {
	  width: "100%",
	},
    block: {
      marginTop: 30
    },
    toggle: {
      marginBottom: 16,
    },
  });

  //Setup gridApi variables as globals so that we have access to them in the onGridReady
  let gridApi = {};
  let gridColumnApi = {};
  let gridOptions = {};
class GridReport extends Component {
	constructor(props) {
		super(props);

		// Add a request interceptor
		let b64EncodedCredentials = localStorage.getItem('creds');
		let b64DecodedCredentials = Base64.decode(b64EncodedCredentials).split(":");
		let [username, password] = [b64DecodedCredentials[0], b64DecodedCredentials[1]];

		axios.interceptors.request.use(function (config) {
			config.auth = { username: username, password: password }//Add axios username/password before request is sent
			return config;
		}, function (error) {
      console.log("Error seting up axios interceptors", error)
			return Promise.reject(error);// Handle axios request error
    });
    

		//Setup initial state
		this.state = {
			loading: true,
			report: {},
			gridOptions: {},
			rowData: [],
			gridState: {},
		}
	};

  /* 
    Loads when grid is rendering & ready to be interacted with.
    The 'this' object of the component is not available to us inside of this method.
    We attach the component to the gridOptions' context property because it represents the entire grid component
    It hold global state & gives us access to the setFilter method
  */
	onGridReady(params) {
		gridApi = params.api;
		gridColumnApi = params.columnApi;
		gridApi.axios = axios;
		gridOptions = this.context.componentParent.state.gridOptions;

		gridOptions.api = gridApi;
		gridOptions.columnApi = gridColumnApi;
		if(localStorage.getItem(this.context.componentParent.state.report.reportid + 'GridGroups')) {
			let groups = JSON.parse(localStorage.getItem(this.context.componentParent.state.report.reportid + 'GridGroups'));
			setTimeout(()=> {
				groups.forEach(groupId => {
					let node = gridOptions.api.getRowNode(groupId);
					node.setExpanded(true);
				  });
			  });
		}
	
		if(gridOptions.setFilter) {
			try {
				gridOptions.api.setFilterModel(gridOptions.setFilter());
			} catch(error) {console.log(error)};
		}   
		gridOptions.api.onFilterChanged();
	}
	
	
	componentWillMount() {
		fetchReport(this.props.params.reportid).then((report) => {
			const stringGridOptions = report.grid.JSON;
			// Perform a reviver function that will convert the grid options string into a proper function.

			let gridOptions = JSON.parse(stringGridOptions,(key, value) => typeof value == "string" ? (value.startsWith("function") ? eval("("+value+")") : value) : value );
			
			
			if(!localStorage.getItem(report.reportid + 'GridGroups')) localStorage.setItem(report.reportid + 'GridGroups', JSON.stringify([])); 

			
			// Catering for grid reports that do not drill down into other reports
			if(gridOptions.detailCellRendererParams && gridOptions.detailCellRendererParams.detailGridOptions.frameworkComponents && gridOptions.detailCellRendererParams.detailGridOptions.frameworkComponents.DrillDownButtonComponent) {
				try {
					gridOptions.detailCellRendererParams.detailGridOptions.frameworkComponents.DrillDownButtonComponent = DrillDownButton;
				} catch(error) {console.log(error)};

				try {
					if(!gridOptions.detailCellRendererParams.detailGridOptions.onRowGroupOpened) gridOptions.detailCellRendererParams.detailGridOptions.onRowGroupOpened = this.onRowGroupOpened;
					if(gridOptions.detailCellRendererParams.detailGridOptions.rowModelType) gridOptions.detailCellRendererParams.detailGridOptions.rowModelType = 'clientSide';

				} catch(error) {console.log(error);}
			}
			if(gridOptions.frameworkComponents) {
				try {
					gridOptions.frameworkComponents.DrillDownButtonComponent = DrillDownButton;
				} catch(error) {console.log(error)}
			}
			//Cater for gridOptions not having context
			if(!gridOptions.context) 
				gridOptions.context = {"componentParent": this};
			else 
				gridOptions.context.componentParent = this;

			//Add default handler for grid row expansion if not set in gridOptions
			if(!gridOptions.onRowGroupOpened) gridOptions.onRowGroupOpened = this.onRowGroupOpened;
			
			// Identify clientSide row model as the default row model if none is supplied from the injected grid options
			if(!gridOptions.rowModelType) gridOptions.rowModelType = 'clientSide';

			gridOptions.modules = AllModules;
			gridOptions.animateRows = true;

			this.setState({
				report:{...report},
				gridOptions: {...gridOptions}
			});

			//Populate the grid report with data
			this.fetchQueryData();
		}).catch((error) => { this.setState({ loading: false, error: true, errormsg : error }); });
	}

	//Triggered when a grid report with a drilldown button has been clicked on
	// We will only drilldown to the first report in the drilldown.values array
	drillDownItemClicked(row) {
        fetchReports().then((data) => {
			if(this.state.report.drilldown.values && this.state.report.drilldown.values.length === 0) return;
			//get item clicked on
            let drilldownValue = this.state.report.drilldown.values[0];
            var drilldownReport = false;
            for (var i = 0; i <= data.length; i++) {
                if (data[i].details.name.toLowerCase() === drilldownValue.reportname.toLowerCase()) {
                    drilldownReport = data[i];
                    break;
                }
            }
            var params = drilldownValue.paramaters.split(",");
            var url = '/' + drilldownValue.reporttype.toLowerCase() + '/' + drilldownReport.reportid + '?';
            for (var n = 0; n < params.length; n++) {
                url = url + params[n] + '=' + row[params[n]] + "&";
			}
			hashHistory.push(url);
        }).catch((error) => {this.setState({ loading: false, error: true, errormsg: error }); });
	}


	//When a grid row is expanded this function is called as the onchange
	onRowGroupOpened(params){
		if(params.node.expanded) {
			this.context.componentParent.saveGridGroupState(Math.abs(params.node.id).toString());
		  } else {
			this.context.componentParent.removeGridGroupState(Math.abs(params.node.id).toString());
		}
	};

		//This function adds the expanded row to localStorage to keep as part of grid state
	saveGridGroupState(id) {
		let groups = JSON.parse(localStorage.getItem(this.state.report.reportid + 'GridGroups'));
		if(groups.indexOf(id) > -1) return;

		groups.push(id);
		localStorage.setItem(this.state.report.reportid + 'GridGroups', JSON.stringify(groups));
	};

	//This function removes the unexpanded row from localStorage
	removeGridGroupState(id) {
		let groups = JSON.parse(localStorage.getItem(this.state.report.reportid + 'GridGroups'));
		let idx = groups.indexOf(id);

		if(idx > -1) {
			groups.splice(idx, 1);
		}
		localStorage.setItem(localStorage.getItem(this.state.report.reportid + 'GridGroups'), JSON.stringify(groups));

	};
	
	
	componentDidUpdate (prevProps, prevState) {
		let prevQ = keys(prevProps.location.query);
		let currentQ = keys(this.props.location.query);
		let changed = _.isEqual(prevQ, currentQ)
		if(!changed) window.location.reload();
		// if(prevProps.location.query.)
	  }

    handBackClicked(){
        localStorage.removeItem('LocalReport' + this.props.params.reportid);
        hashHistory.goBack();
    }

    handleRefreshClick() {
		localStorage.removeItem(this.state.report.reportid + 'GridGroups');
		this.setState({ loading: true });
		if (Object.keys(this.props.location.query).length > 0 && typeof this.props.location.query === 'object') {
			var qr = this.props.location.query;
			delete qr[""];
			var params = keys(qr);
			var vals = values(qr); 
			
			runQueryViaParams(this.state.report, true, params, vals).then( (data) => {
				this.setState({rowData: data, loading: false});
			}).catch(() => { this.setState({ loading: false, error: true }); });
		} else {
			runQuery(this.state.report, true).then((data) => {
				this.setState({rowData: data, loading: false});
				
			}).catch((error) => {
				this.setState({ loading: false, error: true, errormsg: error });
			});
		}
	}

	/* 
		fetchQueryData fetches data from report URL or from runQuery().
		If we fetch data through runQuery(), we refresh the data if the report is an on-demand report (i.e report.OnDemand == true).
		Otherwise we  1st fetch the data from the indexDB, & if we do not find the data, we do a remote call to capi to fetch the data
	*/
	fetchQueryData(){
		if (Object.keys(this.props.location.query).length > 0 && typeof this.props.location.query === 'object') {
			var qr = this.props.location.query;
			delete qr[""];
			var params = keys(qr);
			var vals = values(qr); 
			
			runQueryViaParams(this.state.report, false, params, vals).then( (data) => {
				this.setState({rowData: data, loading: false});
			}).catch(() => { this.setState({ loading: false, error: true }); });
			return;
		}

		if(this.state.report.URL && this.state.report.URL.length > 0) {
			fetchQueryDataByURL(this.state.report.URL).then((data) => {
				this.setState({rowData: data, loading: false});
			}).catch((error) => { this.setState({ loading: false, error: true, errormsg : error }); });
		} else {
			runQuery(this.state.report, false).then( (data) => {
        	this.setState({rowData: data, loading: false});				
			}).catch((error) => { this.setState({ loading: false, error: true, errormsg : error }); });
		}
		
	}

	formatCurrency(number){
		if (!number) return null;
		if (!number.toNumber()) return null;
		return parseFloat(number.toNumber().toFixed(2));
	}

	heatMap(params){
		if (!params) return null;
		if (params.value == '') return null;
		//find max 
		var max = 0; 
		var perc = 0;
		for (var prop in params.node.aggData) {
		var val = params.node.aggData[prop]
		if (val) {
			if (val.toNumber() > max) {
			max = val.toNumber();
			}
		}
		}
		// compare this number to max
		// cater for the value of a deeply nested report not containing helper functions i.e toNumber()
		if(params.value.constructor && params.value.constructor === Object) {
			perc = params.value.toNumber() / max * 100;
		} else {
			perc = params.value / max * 100;
		}
		
		if (perc < 20 ) return {color: 'white', backgroundColor: 'red'};
		if (perc < 40 ) return {color: 'black', backgroundColor: 'tomato'};
		if (perc < 60 ) return {color: 'black', backgroundColor: 'lightyellow'};
		if (perc < 80 ) return {color: 'black', backgroundColor: 'yellow'};
		if (perc < 90 ) return {color: 'black', backgroundColor: 'lightgreen'};
		return {color: 'white', backgroundColor: 'green'};
	}

	


    renderGrid(){
		// If we have data for the grid, we add it to the grid.
		let gridOptions = {...this.state.gridOptions};
		let lastRefresh = '';
        if(this.state.rowData && this.state.rowData.length > 0) gridOptions.rowData = [...this.state.rowData];
		gridOptions.onGridReady = this.onGridReady;

		//TODO: Think of how to handle this better. We need to get data from external source
		if(gridOptions.rowModelType == 'serverSide') gridOptions.serverSideDatasource =  [...this.state.rowData];

		if(!this.state.report.details.ondemand) {
			lastRefresh = (
				<div style={{display:"flex", justifyContent: "flex-end",marginRight:"20px"}}>
					<LastRefreshedLabel queryId={this.state.report.details.queryname}></LastRefreshedLabel>
				</div>
			);	
		}
	
        return (
            <div className={styles.chart}>
                <AppBar title={this.state.report ? this.state.report.details.name : ''}
                iconElementLeft={<IconButton onClick={this.handBackClicked.bind(this)} iconClassName="material-icons"> arrow_back </IconButton>}
                iconElementRight={<IconButton onClick={this.handleRefreshClick.bind(this)} iconClassName="material-icons"> cached </IconButton>}
                />
				<div style={styles.chart}>
					{lastRefresh}
					<Card className={classNames("card")} style={{display:"flex",flexDirection:"column"}}>
						<div className={classNames("ag-theme-balham", "grid-container")}>
							<AgGridReact {...gridOptions} />
						</div>
					</Card>
				</div>
            </div>
        );
    }

  render() {
    return (
        <div>
            {this.state.loading ?  <Loader /> : this.renderGrid()} 
            {this.state.error ? <Error errorMessage={this.state.errormsg} onBackClick={this.handBackClicked.bind(this)} /> : null}
        </div>
    );
  }
  

}

GridReport.propTypes = {
    params: PropTypes.object,
    location: PropTypes.object,
    history: PropTypes.object,
    error: PropTypes.string
  };
  

export default GridReport;