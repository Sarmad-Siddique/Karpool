import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Button, Animated, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import LocationPicker from '../components/LocationPicker';
import DateTimePicker from '../components/DatePickerComponent';
import MapComponent from '../components/MapComponent';
import TopBar from '../components/topBar';
import Sidebar from '../components/Sidebar';
import { useUserMode } from '../store/userModeStore';
import { useMapStore } from '@/store/mapStore';
import { useDateTimeStore } from '@/store/dateTImeStore';
import { useTripStore } from '@/store/useTripStore';
import * as SecureStore from 'expo-secure-store';
import { useUserStore } from '../store/userStore';
import { useVehicleStore } from '../store/vehicleStore'; // Import vehicle store

const DriverOrPassengerHome: React.FC = () => {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const overlayOpacity = React.useRef(new Animated.Value(0)).current;
  
  const router = useRouter();
  const currentMode = useUserMode((state) => state.mode);
  const locationMarker = useMapStore((state) => state.locationMarker);
  const destinationMarker = useMapStore((state) => state.destinationMarker);
  const timeDate = useDateTimeStore((state) => state.time);
  const dates = useDateTimeStore((state) => state.dates);

  // Get userID from the user store
  const { user } = useUserStore();
  const userID = user?.userid;

  // Get vehicleID directly from vehicleStore
  const vehicleID = useVehicleStore((state) => state.vehicleID);

  const dateArray = Object.keys(dates)[0];

  useFocusEffect(
    useCallback(() => {
      // Disable back button when on this page
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
  
      // Re-enable back button when leaving the page
      return () => backHandler.remove();
    }, [])
  );

  // Load token from SecureStore
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('userToken');
        if (storedToken) {
          setToken(storedToken);
        }
      } catch (error) {
        console.error('Error retrieving token:', error);
      }
    };
    loadToken();
  }, []);

  // Compute time string (e.g., "14:35")
  const time = timeDate.getHours() + ":" + timeDate.getMinutes();

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert('Error', 'Token is missing. Please log in again.');
      return;
    }
    
    
    
    const combinedData = {
      //userID,
      //vehicleID,
      //token,
      locationMarker,      // Contains latitude and longitude (and possibly more)
      destinationMarker,   // Contains latitude and longitude (and possibly more)
      time,                // Time as string
      date:dateArray               // Array of date strings or objects
    };

    if (locationMarker === undefined || destinationMarker === undefined || time === undefined || dateArray === undefined)
    {
      Alert.alert('Missing information', 'Enter the information to proceed.');
      return;
    }

    else
    {

    if (currentMode === 'passenger')
    {

    try {
      const response = await fetch('http://10.0.2.2:9000/passenger/getTrips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Platform': 'mobile',
        },
        body: JSON.stringify(combinedData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Getting Trips:",result);
      
        if (result.length === 0) {
          Alert.alert('No Trips Available', 'There are no matching trips at the moment. Please try again later.');
          return;
        }

      // Ensure we only keep trips where the user is NOT the driver
      const filteredTrips = result.filter((trip) => {
        return trip.driverid !== user?.driverid && trip.gender === user?.gender; // Compare as numbers
      });

      
      if (filteredTrips.length === 0) {
        Alert.alert('No Trips Available', 'There are no matching trips at the moment. Please try again later.');
        return; // Stop execution if no trips are found
      }

        useTripStore.getState().setTrips(filteredTrips);
      
        //useTripStore.getState().setTrips(result);
        //Alert.alert('Success', `Trips received: ${JSON.stringify(result)}`);

        router.push('/confirm');
      }
       else {
        Alert.alert('Error', `Server returned status: ${response.status}`);
        console.error(`Server Error: ${response.status}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to send data: ${error}`);
      console.error('Submission Error:', error);
    }
  }
  else{
    router.push('/driverTripDetails');
  }
  }
  };


  const toggleSidebar = (visible: boolean) => {
    setIsSidebarVisible(visible);
    Animated.timing(overlayOpacity, {
      toValue: visible ? 0.5 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      <TopBar onMenuPress={() => toggleSidebar(true)} />
      
      {/* Main content */}
      <View style={[styles.content, isSidebarVisible && styles.contentBlurred]} 
            pointerEvents={isSidebarVisible ? 'none' : 'auto'}>
        {<MapComponent />}
        <View style={styles.bottomView}>
          <Text style={styles.text}>
            {currentMode === 'driver' ? 'Schedule a trip:' : 'Find a trip:'}
          </Text>
          <LocationPicker />
          <DateTimePicker />
          <Button
            title={currentMode === 'driver' ? 'Next' : 'Go'}
            onPress={() => (handleSubmit())}
          />
        </View>
      </View>

      {/* Dimming overlay */}
      {isSidebarVisible && (
        <Animated.View 
          style={[styles.overlay, { opacity: overlayOpacity }]} 
          pointerEvents="none"
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        isVisible={isSidebarVisible} 
        onClose={() => toggleSidebar(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentBlurred: {
    opacity: 0.9,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    zIndex: 1,
  },
  bottomView: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'grey',
  },
  text: {
    marginBottom: 15,
    fontWeight: '600',
    fontSize: 20,
  },
});

export default DriverOrPassengerHome;
