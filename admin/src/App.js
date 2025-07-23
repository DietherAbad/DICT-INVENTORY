import { Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import React, { useContext, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import MainDashboard from './pages/MainDashboard';
import OfficeDashboard from './pages/OfficeDashboard';
import FreewifiDashboard from './pages/FreewifiDashboard';
import GovnetDashboard from './pages/GovnetDashboard';
import UsersDashboard from './pages/UsersDashboard';
import StocksDashboard from './pages/StocksDashboard';
import SettingsDashboard from './pages/SettingsDashboard';
import Stock from './pages/Stock';
import Purchase from './pages/Purchase';
import { Purchaseform } from './forms/Purchaseform';
import { PurchaseformICTequipment } from './forms/PurchaseformofficeICTequipment';
import { PurchaseformMotorandVehicles } from './forms/Purchaseformofficemotorandvehicles';
import { Purchaseformfurnitureandfixture } from './forms/Purchaseformofficefurnitureandfixture';
import { Purchaseformofficeequipment } from './forms/Purchaseformofficeequipment';
import { PurchaseformLandandBuilding } from './forms/Purchaseformofficelandandbuilding';
import { PurchaseformFreewifi } from './forms/PurchaseformFreewifi';
import { PurchaseformGovnetsupply } from './forms/PurchaseformGovnetsupply';
import { Purchaseformgovnetequipment } from './forms/Purchaseformgovnetequipment';
import { Stockinform } from './forms/Stockin';
import { Distribute } from './forms/Distribute';
import Stocktableofficesupply from './table/Stocktableofficesupply';
import DistributionTable from './table/Stocktableofficesupplydistribution';
import Stocktableofficeequipments from './table/Stocktableofficeequipments';
import Stocktablefreewifiequipments from './table/Stocktablefreewifiequipments';
import Stocktablegovnetequipments from './table/Stocktablegovnetequipments';
import Stocktablegovnetsupply from './table/Stocktablegovnetsupply';
import Stocktableofficefurnitureandfixtures from './table/Stocktableofficefurnitureandfixtures'
import Stocktableofficeictequipments from './table/Stocktableofficeictequipments'
import Stocktableofficelandandtitle from './table/Stocktableofficelandandbuilding'
import Stocktableofficemotorandvehicles from './table/Stocktableofficemotorandvehicles'
import Stocktable from './table/Stocktable';
import Reportstableofficeequipments from './table/Reportstableofficeequipments';
import Reportstableofficesupply from './table/Reportstableofficesupply';
import Reportstableofficefurnitureandfixtures from './table/Reportstableofficefurnitureandfixtures';
import Reportstableofficeictequipments from './table/Reportstableofficeictequipments';
import Reportstablegovnetsupply from './table/Reportstablegovnetsupply';
import Reportstablegovnetequipments from './table/Reportstablegovnetequipments';
import Reportstablefreewifiequipments from './table/Reportstablefreewifiequipments';
import Template from './navigation/Template';
import TemplateFreewifi from './navigation/TemplateFreewifi';
import TemplateGovnet from './navigation/TemplateGovnet';
import TemplateUsers from './navigation/TemplateUsers';
import TemplateSettings from './navigation/TemplateSettings';
import Checkitem from './details/Checkitem';
import Checkitemsupply from './details/Checkitemsupply';
import Checkitemfurniture from './details/Checkitemfurniture';
import Checkitemictequip from './details/Checkitemictequip';
import Checkitemgovnetequip from './details/Checkitemgovnetequip';
import Checkitemgovnetsupply from './details/Checkitemgovnetsupply';
import Checkitemfreewifi from './details/Checkitemfreewifi';
import Checkuser from './details/Checkuser';
import Checkuserforadmin from './details/Checkuserforadmin';
import Userstable from './table/Userstable';
import Managementtable from './table/ManagementTable';
import MeasureTable from './table/MeasureTable';
import ClassificationTable from './table/ClassificationTable';
import MyInventorytable from './table/MyInventorytable';
import Request from './table/Request';
import { Checkform } from './details/Checkform';
import { AuthContext } from "./context/AuthContext";

function App() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();             
  
  useEffect(() => {
    if (!user) {
      const path = location.pathname;
      if (!path.startsWith('/checkitem')) {
        navigate('/login');
      }
    }
  }, [user, navigate, location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={user ? <MainDashboard /> : <Navigate to="/login" />} />
      <Route path="/dashboard" element={user ? <StocksDashboard /> : <Navigate to="/login" />} />
      <Route path="/officedashboard" element={user ? <Template><OfficeDashboard /></Template> : <Navigate to="/login" />} />
      <Route path="/freewifidashboard" element={user ? <TemplateFreewifi><FreewifiDashboard /></TemplateFreewifi> : <Navigate to="/login" />} />
      <Route path="/govnetdashboard" element={user ? <TemplateGovnet><GovnetDashboard /></TemplateGovnet> : <Navigate to="/login" />} />
      <Route path="/userdashboard" element={user ? <TemplateUsers><UsersDashboard /></TemplateUsers> : <Navigate to="/login" />} />
      <Route path="/settingsdashboard" element={user ? <TemplateSettings><SettingsDashboard /></TemplateSettings> : <Navigate to="/login" />} />
      <Route path="/stock" element={user ? <Stock /> : <Navigate to="/login" />} />
      <Route path="/purchase" element={user ? <Purchase /> : <Navigate to="/login" />} />
      <Route path="/purchaseform" element={user ? <Purchaseform /> : <Navigate to="/login" />} />
      <Route path="/purchaseformICT" element={user ? <PurchaseformICTequipment /> : <Navigate to="/login" />} />
      <Route path="/purchaseformMotor" element={user ? <PurchaseformMotorandVehicles /> : <Navigate to="/login" />} />
      <Route path="/purchaseformFurniture" element={user ? <Purchaseformfurnitureandfixture /> : <Navigate to="/login" />} />
      <Route path="/purchaseformEquip" element={user ? <Purchaseformofficeequipment /> : <Navigate to="/login" />} />
      <Route path="/purchaseformLand" element={user ? <PurchaseformLandandBuilding /> : <Navigate to="/login" />} />
      <Route path="/purchaseformFreewifi" element={user ? <PurchaseformFreewifi /> : <Navigate to="/login" />} />
      <Route path="/purchaseformGovnet" element={user ? <PurchaseformGovnetsupply /> : <Navigate to="/login" />} />
      <Route path="/purchaseformGovnetequip" element={user ? <Purchaseformgovnetequipment /> : <Navigate to="/login" />} />
      <Route path="/users" element={user ? <Userstable /> : <Navigate to="/login" />} />
      <Route path="/management" element={user ? <Managementtable /> : <Navigate to="/login" />} />
      <Route path="/measure" element={user ? <MeasureTable /> : <Navigate to="/login" />} />
      <Route path="/classification" element={user ? <ClassificationTable /> : <Navigate to="/login" />} />
      <Route path="/myinventory" element={user ? <Template><MyInventorytable /></Template> : <Navigate to="/login" />} />
      <Route path="/request" element={user ? <Template><Request /></Template> : <Navigate to="/login" />} />
      <Route path="/stocktableofficesupply" element={user ? <Stocktableofficesupply /> : <Navigate to="/login" />} />
      <Route path="/distributiontableofficesupply" element={user ? <DistributionTable /> : <Navigate to="/login" />} />
      <Route path="/stocktableofficeequipments" element={user ? <Stocktableofficeequipments /> : <Navigate to="/login" />} />
      <Route path="/stocktablefreewifiequipments" element={user ? <Stocktablefreewifiequipments /> : <Navigate to="/login" />} />
      <Route path="/stocktablegovnetequipments" element={user ? <Stocktablegovnetequipments /> : <Navigate to="/login" />} />
      <Route path="/stocktablegovnetsupply" element={user ? <Stocktablegovnetsupply /> : <Navigate to="/login" />} />
      <Route path="/stocktablefurnitureandfixture" element={user ? <Stocktableofficefurnitureandfixtures /> : <Navigate to="/login" />} />
      <Route path="/stocktableofficeictequipments" element={user ? <Stocktableofficeictequipments /> : <Navigate to="/login" />} />
      <Route path="/stocktableofficelandandtitle" element={user ? <Stocktableofficelandandtitle /> : <Navigate to="/login" />} />
      <Route path="/stocktableofficemotorandvehicles" element={user ? <Stocktableofficemotorandvehicles /> : <Navigate to="/login" />} />
      <Route path="/stocktable" element={user ? <Stocktable /> : <Navigate to="/login" />} />
      <Route path="/stockform" element={user ? <Stockinform /> : <Navigate to="/login" />} />
      <Route path="/reportstableofficeequip" element={user ? <Reportstableofficeequipments /> : <Navigate to="/login" />} />
      <Route path="/reportstableofficesupply" element={user ? <Reportstableofficesupply /> : <Navigate to="/login" />} />
      <Route path="/reportstableofficfurnitureandfixture" element={user ? <Reportstableofficefurnitureandfixtures /> : <Navigate to="/login" />} />
      <Route path="/reportstableofficeictequip" element={user ? <Reportstableofficeictequipments /> : <Navigate to="/login" />} />
      <Route path="/reportstablegovnetequipments" element={user ? <Reportstablegovnetequipments /> : <Navigate to="/login" />} />
      <Route path="/reportstablegovnetsupply" element={user ? <Reportstablegovnetsupply /> : <Navigate to="/login" />} />
      <Route path="/reportstablefreewifi" element={user ? <Reportstablefreewifiequipments /> : <Navigate to="/login" />} />
      <Route path="/distributeform" element={user ? <Distribute /> : <Navigate to="/login" />} />
      <Route path="/checkitem/:id" element={<Checkitem />} />
      <Route path="/checkitemsupply/:id" element={user ? <Checkitemsupply /> : <Navigate to="/login" />} />
      <Route path="/checkitemfurniture/:id" element={user ? <Checkitemfurniture /> : <Navigate to="/login" />} />
      <Route path="/checkitemict/:id" element={user ? <Checkitemictequip /> : <Navigate to="/login" />} />
      <Route path="/checkitemgovnetequip/:id" element={user ? <Checkitemgovnetequip /> : <Navigate to="/login" />} />
      <Route path="/checkitemgovnetsupply/:id" element={user ? <Checkitemgovnetsupply /> : <Navigate to="/login" />} />
      <Route path="/checkitemfreewifi/:id" element={user ? <Checkitemfreewifi /> : <Navigate to="/login" />} />
      <Route path="/checkuser" element={user ? <Checkuser /> : <Navigate to="/login" />} />
      <Route path="/checkuserforadmin/:id" element={user ? <Checkuserforadmin /> : <Navigate to="/login" />} />
      <Route path="/checkform/:id" element={user ? <Template><Checkform /></Template> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
